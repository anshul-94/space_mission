"""
Space Mission Analytics Dashboard
FastAPI ML Prediction Server
"""

# ==================================================
# IMPORT LIBRARIES
# ==================================================

import joblib
import pandas as pd
import numpy as np

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sklearn.linear_model import LinearRegression


# ==================================================
# CREATE FASTAPI APP
# ==================================================

app = FastAPI(
    title="Space Mission ML API",
    description="Machine Learning API for Space Mission Analytics Dashboard",
    version="2.0"
)


# ==================================================
# ENABLE CORS
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# LOAD DATASET
# ==================================================

try:

    dataset = pd.read_csv("ml/data/space_mission_cleaned.csv")

    print("Dataset loaded successfully")

except Exception as e:

    dataset = None
    print("Dataset loading failed:", e)


# ==================================================
# GLOBAL VARIABLES
# ==================================================

success_model = None
forecast_model = None
models_loaded = False


# ==================================================
# LOAD ML MODELS
# ==================================================

def load_models():

    global success_model, forecast_model, models_loaded

    try:

        success_model = joblib.load("ml/models/success_prediction.pkl")

        forecast_model = joblib.load("ml/models/launch_forecast.pkl")

        models_loaded = True

        print("ML models loaded successfully")

    except Exception as e:

        models_loaded = False
        print("Model loading failed:", e)


load_models()


# ==================================================
# PYDANTIC MODEL
# ==================================================

class MissionInput(BaseModel):

    company: str
    country: str
    rocket_status: str
    launch_year: int
    launch_month: int
    rocket_cost: float


# ==================================================
# ROOT API
# ==================================================

@app.get("/")
def root():

    return {

        "message": "Space Mission ML API Running",

        "documentation": "/docs",

        "available_endpoints": [

            "/metadata",

            "/analytics/{country}",

            "/country-distribution?top=5",

            "/launch-forecast",

            "/insights/{country}",

            "/predict-mission",

            "/health"

        ]

    }


# ==================================================
# HEALTH CHECK
# ==================================================

@app.get("/health")
def health():

    return {

        "status": "ok",

        "dataset_loaded": dataset is not None,

        "models_loaded": models_loaded

    }


# ==================================================
# METADATA API
# ==================================================

@app.get("/metadata")
def metadata():

    if dataset is None:
        raise HTTPException(status_code=500, detail="Dataset not loaded")

    return {

        "countries": sorted(dataset["country"].dropna().unique().tolist()),

        "companies": sorted(dataset["company"].dropna().unique().tolist()),

        "rocket_status": sorted(dataset["rocket_status"].dropna().unique().tolist())

    }


# ==================================================
# ANALYTICS API (FILTER BY COUNTRY)
# ==================================================

@app.get("/analytics/{country}")
def analytics(country: str):

    if dataset is None:
        raise HTTPException(status_code=500, detail="Dataset not loaded")

    df = dataset.copy()

    if country.lower() != "all":

        df = df[df["country"].str.lower() == country.lower()]

    success = int(df["success_flag"].sum())

    failure = int(len(df) - success)

    yearly = df.groupby("launch_year").agg(
        total=("success_flag", "count"),
        success=("success_flag", "sum")
    ).reset_index()
    yearly["failure"] = yearly["total"] - yearly["success"]
    
    launches_per_year = {}
    for _, row in yearly.iterrows():
        launches_per_year[int(row["launch_year"])] = {
            "total": int(row["total"]),
            "success": int(row["success"]),
            "failure": int(row["failure"])
        }

    if not df.empty:
        top_country = df["country"].mode()[0] if not df["country"].mode().empty else "N/A"
        
        # Company with highest success rate
        company_success = df.groupby("company")["success_flag"].mean()
        # Find the company with the highest success rate. To break ties (e.g., both have 1.0), 
        # we could factor in total launches, but idxmax() is sufficient.
        top_company = company_success.idxmax() if not company_success.empty else "N/A"
    else:
        top_country = "N/A"
        top_company = "N/A"

    return {

        "success_vs_failure": {

            "success": success,

            "failure": failure

        },

        "launches_per_year": launches_per_year,
        
        "top_country": top_country,
        
        "top_company": top_company

    }


# ==================================================
# COUNTRY DISTRIBUTION (TOP N)
# ==================================================

@app.get("/country-distribution")
def country_distribution(top: str = Query("5")):

    if dataset is None:
        raise HTTPException(status_code=500, detail="Dataset not loaded")

    counts = (

        dataset.groupby("country")
        .size()
        .sort_values(ascending=False)

    )

    if top != "All":

        counts = counts.head(int(top))

    return {

        "countries": counts.index.tolist(),

        "launches": counts.values.tolist()

    }


# ==================================================
# AI INSIGHTS
# ==================================================

@app.get("/insights/{country}")
def insights(country: str):

    if dataset is None:
        raise HTTPException(status_code=500, detail="Dataset not loaded")

    df = dataset.copy()

    if country.lower() != "all":

        df = df[df["country"].str.lower() == country.lower()]

    if df.empty:

        return {

            "country": country,

            "insights": ["No mission data available"]

        }

    insights = []

    success_rate = round(df["success_flag"].mean() * 100, 1)

    insights.append(

        f"{country} missions show a success rate of {success_rate}%."

    )

    before = df[df["launch_year"] < 2015]

    after = df[df["launch_year"] >= 2015]

    if len(after) > len(before):

        insights.append(

            f"{country} launches increased significantly after 2015."

        )

    else:

        insights.append(

            f"{country} launch activity was higher before 2015."

        )

    company_success = df.groupby("company")["success_flag"].mean()

    best_company = company_success.idxmax()

    best_rate = round(company_success.max() * 100, 1)

    insights.append(

        f"{best_company} is the most reliable launch provider with {best_rate}% success rate."

    )

    return {

        "country": country,

        "insights": insights

    }


# ==================================================
# MISSION SUCCESS PREDICTION
# ==================================================

@app.post("/predict-mission")
def predict_mission(data: MissionInput):

    if not models_loaded:
        raise HTTPException(status_code=500, detail="Prediction model not loaded")

    try:

        input_df = pd.DataFrame([data.dict()])

        prediction = success_model.predict(input_df)[0]

        probability = success_model.predict_proba(input_df)[0].max()

        result = "Success" if prediction == 1 else "Failure"

        return {

            "prediction": result,

            "probability": round(float(probability), 2)

        }

    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))


# ==================================================
# LAUNCH FORECAST (HISTORICAL + FUTURE)
# ==================================================
@app.get("/launch-forecast")
def launch_forecast(country: str = "All"):

    df = pd.read_csv("ml/data/space_mission_cleaned.csv")

    # Country filter
    if country != "All":
        df = df[df["country"] == country]

    launches_per_year = df.groupby("launch_year").size().reset_index(name="launches")

    years = launches_per_year["launch_year"].tolist()
    launches = launches_per_year["launches"].tolist()

    # numpy → python int
    years = [int(y) for y in years]
    launches = [int(l) for l in launches]

    # Forecast next 5 years
    last_year = years[-1]

    future_years = [last_year + i for i in range(1, 6)]
    future_launches = [int(launches[-1] * (1 + 0.05 * i)) for i in range(1, 6)]

    all_years = years + future_years
    all_launches = launches + future_launches

    return {
        "country": country,
        "years": all_years,
        "launches": all_launches,
        "split_index": len(years)
    }
