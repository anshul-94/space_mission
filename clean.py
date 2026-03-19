# -----------------------------------------
# STEP 1 — Load Dataset
# -----------------------------------------

import pandas as pd
import numpy as np

# Load dataset
df = pd.read_csv("datasets/Space_Corrected.csv")

print("Dataset Shape:", df.shape)

print("\nColumn Names:")
print(df.columns)

print("\nFirst 10 Rows:")
print(df.head(10))

print("\nMissing Values:")
print(df.isnull().sum())

print("\nData Types:")
print(df.dtypes)


# -----------------------------------------
# STEP 2 — Remove Useless Columns
# -----------------------------------------

columns_to_drop = ["Unnamed: 0", "Unnamed: 0.1"]
df = df.drop(columns=columns_to_drop, errors="ignore")

df = df.reset_index(drop=True)

print("\nColumns after removal:")
print(df.columns)


# -----------------------------------------
# STEP 3 — Clean Column Names
# -----------------------------------------

df = df.rename(columns={
    "Company Name": "company",
    "Location": "location",
    "Datum": "launch_date",
    "Detail": "mission_detail",
    "Status Rocket": "rocket_status",
    " Rocket": "rocket_cost",
    "Status Mission": "mission_status"
})

df.columns = df.columns.str.lower().str.replace(" ", "_")

print("\nCleaned Column Names:")
print(df.columns)


# -----------------------------------------
# STEP 4 — Date Processing
# -----------------------------------------

df["launch_date"] = pd.to_datetime(df["launch_date"], errors="coerce")

df["launch_year"] = df["launch_date"].dt.year
df["launch_month"] = df["launch_date"].dt.month
df["launch_day"] = df["launch_date"].dt.day


# -----------------------------------------
# STEP 5 — Location Processing
# -----------------------------------------

location_split = df["location"].str.split(",", expand=True)

df["launch_site"] = location_split[0].str.strip()
df["country"] = location_split[location_split.columns[-1]].str.strip()


# -----------------------------------------
# STEP 6 — Handle Missing Values
# -----------------------------------------

df["rocket_cost"] = pd.to_numeric(df["rocket_cost"], errors="coerce")

median_cost = df["rocket_cost"].median()
df["rocket_cost"] = df["rocket_cost"].fillna(median_cost)

df["mission_status"] = df["mission_status"].str.strip()

df["mission_status"] = df["mission_status"].replace({
    "Success": "Success",
    "Failure": "Failure",
    "Partial Failure": "Partial Failure",
    "Prelaunch Failure": "Prelaunch Failure"
})

df["rocket_status"] = df["rocket_status"].str.replace("Status", "", regex=False)

df["rocket_status"] = df["rocket_status"].replace({
    "Active": "Active",
    "Retired": "Retired"
})


# -----------------------------------------
# STEP 7 — Feature Engineering
# -----------------------------------------

df["success_flag"] = df["mission_status"].apply(
    lambda x: 1 if x == "Success" else 0
)

rocket_stats = df.groupby("mission_detail")["success_flag"].agg(["sum", "count"])

rocket_stats["rocket_reliability_score"] = (
    rocket_stats["sum"] / rocket_stats["count"]
)

rocket_stats = rocket_stats["rocket_reliability_score"]

df = df.merge(
    rocket_stats,
    on="mission_detail",
    how="left"
)

missions_per_company = df.groupby("company").size()

df["missions_per_company"] = df["company"].map(missions_per_company)


# -----------------------------------------
# STEP 8 — Data Validation
# -----------------------------------------

duplicates = df.duplicated().sum()
print("\nDuplicate Rows:", duplicates)

df = df.drop_duplicates()

df = df[df["launch_date"].notna()]
df = df[df["company"].notna()]


# -----------------------------------------
# STEP 9 — Company → Country Mapping
# -----------------------------------------

company_country = {
'SpaceX':'USA','CASC':'China','Roscosmos':'Russia','ULA':'USA','JAXA':'Japan',
'Northrop':'USA','ExPace':'China','IAI':'Israel','Rocket Lab':'USA',
'Virgin Orbit':'USA','VKS RF':'Russia','MHI':'Japan','IRGC':'Iran',
'Arianespace':'France','ISA':'Iran','Blue Origin':'USA','ISRO':'India',
'Exos':'USA','ILS':'USA','i-Space':'Japan','OneSpace':'China',
'Landspace':'China','Eurockot':'Russia','Land Launch':'Russia',
'CASIC':'China','KCST':'Russia','Kosmotras':'Russia','Khrunichev':'Russia',
'Sea Launch':'Russia','KARI':'South Korea','ESA':'Europe','NASA':'USA',
'Boeing':'USA','ISAS':'Japan','SRC':'Russia','MITT':'Russia',
'Lockheed':'USA','Starsem':'Russia','AEB':'Russia','RVSN USSR':'USSR',
'EER':'Russia','General Dynamics':'USA','Martin Marietta':'USA',
'Yuzhmash':'Ukraine','Douglas':'USA','ASI':'Italy','US Air Force':'USA',
'CNES':'France','CECLES':'France','RAE':'UK','UT':'UK','OKB-586':'USSR',
"Arm??e de l'Air":'France','US Navy':'USA','AMBA':'France'
}

df["country"] = df["company"].map(company_country).fillna(df["country"])


# -----------------------------------------
# STEP 10 — Final Dataset for Dashboard
# -----------------------------------------

final_columns = [
    "company",
    "country",
    "launch_site",
    "launch_date",
    "launch_year",
    "launch_month",
    "rocket_status",
    "rocket_cost",
    "mission_status",
    "success_flag",
    "mission_detail"
]

clean_df = df[final_columns]


# -----------------------------------------
# STEP 11 — Save Clean Dataset
# -----------------------------------------

clean_df.to_csv("ml/data/space_mission_cleaned.csv", index=False)

print("\nClean dataset saved successfully → ml/data/space_mission_cleaned.csv 🚀")
