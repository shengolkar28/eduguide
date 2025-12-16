import json
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score
import joblib

from xgboost import XGBClassifier  # pip install xgboost


# Paths
DATA_PATH = "final_dataset.csv"              # adjust if needed
MODEL_PATH = "career_recommender_xgb.joblib" # output model file


def parse_list_column(cell):
  """
  Dataset stores some fields as JSON arrays (e.g. ["Python", "ML"]).
  This helper turns them into a space-separated string like: "Python ML".
  """
  if pd.isna(cell):
    return ""
  if isinstance(cell, list):
    return " ".join(str(x) for x in cell)

  # if it's a JSON string, try to parse
  try:
    data = json.loads(cell)
    if isinstance(data, list):
      return " ".join(str(x) for x in data)
    return str(data)
  except Exception:
    # fallback: treat as raw string
    return str(cell)


def build_profile_text(df: pd.DataFrame) -> pd.Series:
  """
  Combine all relevant user attributes into a single text field per row.
  This is what the TF-IDF will be trained on.
  """

  list_cols = [
    "skills",
    "interests",
    "strengths",
    "weaknesses",
    "learning_formats",
    "preferred_work_environment",
  ]

  text_cols = [
    "personality_work_type",
    "personality_work_style",
    "personality_env_pref",
    "personality_stress_handling",
    "learning_pace",
    "mode_preference",
    "salary_expectation",
  ]

  # convert list-like columns into text
  for col in list_cols:
    if col in df.columns:
      df[col + "_txt"] = df[col].apply(parse_list_column)
    else:
      df[col + "_txt"] = ""

  # ensure text columns are strings
  for col in text_cols:
    if col in df.columns:
      df[col + "_txt"] = df[col].fillna("").astype(str)
    else:
      df[col + "_txt"] = ""

  text_features = []

  for col in list_cols:
    text_features.append(df[col + "_txt"])

  for col in text_cols:
    text_features.append(df[col + "_txt"])

  # join everything into one big string per row
  profile_text = (
    text_features[0]
      .str.cat(text_features[1:], sep=" ", na_rep="")
      .str.replace(r"\s+", " ", regex=True)
      .str.strip()
  )

  return profile_text


def main():
  # ----------------------------
  # 1. Load and prepare data
  # ----------------------------
  df = pd.read_csv(DATA_PATH)

  if "target_recommended_career" not in df.columns:
    raise ValueError("Column 'target_recommended_career' not found in dataset.")

  # Target labels
  y = df["target_recommended_career"].astype(str)

  # Build combined text feature
  X_text = build_profile_text(df)

  # ----------------------------------------
  # 2. Train-test split for evaluation
  # ----------------------------------------
  X_train, X_test, y_train, y_test = train_test_split(
    X_text,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y,
  )

  # ----------------------------------------
  # 3. Build supervised TF-IDF + XGBoost pipeline
  # ----------------------------------------
  xgb_clf = XGBClassifier(
    n_estimators=250,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.9,
    colsample_bytree=0.9,
    objective="multi:softmax",  # multi-class classification
    eval_metric="mlogloss",
    tree_method="hist",         # faster on CPU
    random_state=42,
    n_jobs=-1
  )

  model = Pipeline(
    steps=[
      (
        "tfidf",
        TfidfVectorizer(
          max_features=5000,
          ngram_range=(1, 2),
          stop_words="english"
        ),
      ),
      ("clf", xgb_clf),
    ]
  )

  print("[INFO] Training supervised XGBoost career recommendation model...")
  model.fit(X_train, y_train)

  # ----------------------------------------
  # 4. Evaluate on held-out test set
  # ----------------------------------------
  print("[INFO] Evaluating model...")
  y_pred = model.predict(X_test)

  acc = accuracy_score(y_test, y_pred)
  print(f"[RESULT] Test Accuracy (XGBoost): {acc:.4f}\n")

  print("[RESULT] Classification report:")
  print(classification_report(y_test, y_pred))

  # ----------------------------------------
  # 5. Save model pipeline
  # ----------------------------------------
  joblib.dump(model, MODEL_PATH)
  print(f"[INFO] Trained XGBoost model pipeline saved to: {MODEL_PATH}")


if __name__ == "__main__":
  main()