"""
Space Mission Analytics Dashboard
Model Training Script

This script trains two models:

1️⃣ Mission Success Prediction Model (RandomForest)
2️⃣ Launch Trend Forecast Model (Linear Regression)

After training, the models are saved in:
ml/models/
"""

# ============================================
# IMPORT LIBRARIES
# ============================================

import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LinearRegression

from sklearn.metrics import accuracy_score
from sklearn.metrics import classification_report
from sklearn.metrics import confusion_matrix


# ============================================
# LOAD DATASET
# ============================================

def load_dataset():

    print("\nLoading dataset...")

    df = pd.read_csv("ml/data/space_mission_cleaned.csv")

    print("Dataset loaded successfully")

    print("Dataset shape:", df.shape)

    return df


# ============================================
# TRAIN MODEL 1
# Mission Success Prediction
# ============================================

def train_success_model(df):

    print("\nTraining Mission Success Prediction Model...")

    # Select features
    features = [
        "company",
        "country",
        "rocket_status",
        "launch_year",
        "launch_month",
        "rocket_cost"
    ]

    target = "success_flag"

    X = df[features]
    y = df[target]

    # Categorical features
    categorical_features = [
        "company",
        "country",
        "rocket_status"
    ]

    # Numerical features
    numerical_features = [
        "launch_year",
        "launch_month",
        "rocket_cost"
    ]

    # OneHotEncoder for categorical data
    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
            ("num", "passthrough", numerical_features)
        ]
    )

    # Model
    model = RandomForestClassifier(
        n_estimators=200,
        random_state=42
    )

    # Create pipeline
    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model)
        ]
    )

    # Train test split
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42
    )

    print("Training samples:", X_train.shape[0])
    print("Testing samples:", X_test.shape[0])

    # Train model
    pipeline.fit(X_train, y_train)

    # Predictions
    train_preds = pipeline.predict(X_train)
    test_preds = pipeline.predict(X_test)

    # Accuracy
    train_acc = accuracy_score(y_train, train_preds)
    test_acc = accuracy_score(y_test, test_preds)

    print("\nTraining Accuracy:", round(train_acc, 4))
    print("Testing Accuracy:", round(test_acc, 4))

    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, test_preds))

    print("\nClassification Report:")
    print(classification_report(y_test, test_preds))

    # Save model
    joblib.dump(pipeline, "ml/models/success_prediction.pkl")

    print("\nModel saved → ml/models/success_prediction.pkl")


# ============================================
# TRAIN MODEL 2
# Launch Trend Forecast
# ============================================

def train_launch_forecast(df):

    print("\nTraining Launch Forecast Model...")

    # Group by year
    launches_per_year = df.groupby("launch_year").size().reset_index(name="launches")

    print("\nLaunches per year dataset:")
    print(launches_per_year.head())

    X = launches_per_year[["launch_year"]]
    y = launches_per_year["launches"]

    # Train Linear Regression model
    model = LinearRegression()

    model.fit(X, y)

    # Forecast next 5 years
    last_year = launches_per_year["launch_year"].max()

    future_years = pd.DataFrame({
        "launch_year": np.arange(last_year + 1, last_year + 6)
    })

    forecast = model.predict(future_years)

    forecast_df = future_years.copy()
    forecast_df["predicted_launches"] = forecast.astype(int)

    print("\nLaunch Forecast (Next 5 Years):")
    print(forecast_df)

    # Save forecasting model
    joblib.dump(model, "ml/models/launch_forecast.pkl")

    print("\nForecast model saved → ml/models/launch_forecast.pkl")


# ============================================
# MAIN TRAINING FUNCTION
# ============================================

def main():

    print("\n==============================")
    print("SPACE MISSION MODEL TRAINING")
    print("==============================")

    # Load data
    df = load_dataset()

    # Train success prediction model
    train_success_model(df)

    # Train launch forecast model
    train_launch_forecast(df)

    print("\nAll models trained successfully")


# ============================================
# RUN SCRIPT
# ============================================

if __name__ == "__main__":
    main()
