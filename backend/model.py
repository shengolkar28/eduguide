import os
import pandas as pd
import numpy as np
import json

# -------------------------------------------
# CONFIG
# -------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "ml_data", "final_dataset.csv")

LIST_COLS = [
    "skills",
    "interests",
    "strengths",
    "weaknesses",
    "learning_formats",
    "preferred_work_environment",
]

SCALAR_COLS = [
    "personality_work_type",
    "personality_work_style",
    "personality_env_pref",
    "personality_stress_handling",
    "learning_pace",
    "mode_preference",
    "salary_expectation",
]

WEIGHTS = {
     "skills": 0.25,                     # still important, but not overpowering
    "interests": 0.20,
    "strengths": 0.15,
    "weaknesses": 0.05,                 # remains a small penalty
    "learning_formats": 0.10,
    "preferred_work_environment": 0.15,
    "scalar_personality": 0.05,
    "scalar_learning_mode": 0.03,
    "scalar_salary": 0.02,
}

# -------------------------------------------
# HELPERS
# -------------------------------------------

def parse_list(x):
    """Parse JSON list / Python list / comma-separated string -> Python list."""
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return []
    if isinstance(x, list):
        return x
    if isinstance(x, str):
        s = x.strip()
        if not s:
            return []
        try:
            v = json.loads(s)
            if isinstance(v, list):
                return v
        except Exception:
            return [p.strip() for p in s.split(",") if p.strip()]
    return []

def extract_any_list(x):
    """
    Try to pull any list(s) out of nested structures:
    - list -> itself
    - dict -> concat of any list values
    - anything else -> []
    """
    if isinstance(x, list):
        return x
    if isinstance(x, dict):
        out = []
        for v in x.values():
            if isinstance(v, list):
                out.extend(v)
        return out
    return []

def to_set(lst):
    return set(str(i).strip() for i in lst if str(i).strip())

def list_similarity(user_list, row_list):
    """|intersection| / max(|user_list|, 1) – reward matching user selections."""
    u = to_set(user_list)
    r = to_set(row_list)
    if not u:
        return 0.0
    inter = len(u & r)
    return inter / max(len(u), 1)

def list_penalty(user_list, row_list):
    """Weakness penalty: overlap reduces score."""
    u = to_set(user_list)
    r = to_set(row_list)
    if not u:
        return 0.0
    inter = len(u & r)
    return - inter / max(len(u), 1)

def scalar_similarity(user_value, row_value):
    """Return 1.0 if equal (case-insensitive), else 0."""
    if not user_value or not row_value:
        return 0.0
    return 1.0 if str(user_value).strip().lower() == str(row_value).strip().lower() else 0.0

# -------------------------------------------
# LOAD DATASET
# -------------------------------------------

profiles = pd.read_csv(DATA_PATH)
print("Loaded profiles:", len(profiles))

for col in LIST_COLS:
    if col in profiles.columns:
        profiles[col] = profiles[col].apply(parse_list)

# -------------------------------------------
# NORMALIZE USER PROFILE
# -------------------------------------------

def normalize_user_profile(profile: dict) -> dict:
    """
    Tries to map whatever structure you saved in Mongo into the flat keys
    used by the dataset: skills, interests, strengths, weaknesses,
    learning_formats, preferred_work_environment, personality_*, etc.
    """

    # unwrap if { "profile": {...} }
    if "skills" not in profile and "profile" in profile and isinstance(profile["profile"], dict):
        profile = profile["profile"]

    norm = {}

    # ----- skills -----
    raw_skills = profile.get("skills")
    # skills might be list or nested under skills.selected etc.
    skills = extract_any_list(raw_skills)
    norm["skills"] = skills

    # ----- interests -----
    raw_interests = profile.get("interests")
    norm["interests"] = extract_any_list(raw_interests)

    # ----- strengths & weaknesses -----
    raw_strengths = profile.get("strengths")
    raw_weaknesses = profile.get("weaknesses")

    # often you stored them under "strengthsWeaknesses": { strengths:[], weaknesses:[] }
    sw = profile.get("strengthsWeaknesses") or profile.get("strengths_weaknesses")
    if isinstance(sw, dict):
        if not raw_strengths:
            raw_strengths = sw.get("strengths")
        if not raw_weaknesses:
            raw_weaknesses = sw.get("weaknesses")

    norm["strengths"] = extract_any_list(raw_strengths)
    norm["weaknesses"] = extract_any_list(raw_weaknesses)

    # ----- learning formats / pace / mode -----
    lp_section = profile.get("learningPreferences") or profile.get("learning_preferences") or {}
    raw_lf = profile.get("learning_formats") or lp_section.get("learning_formats") or lp_section.get("formats")
    norm["learning_formats"] = extract_any_list(raw_lf)

    norm["learning_pace"] = (
        profile.get("learning_pace")
        or lp_section.get("learning_pace")
        or lp_section.get("pace")
    )

    norm["mode_preference"] = (
        profile.get("mode_preference")
        or lp_section.get("mode_preference")
        or lp_section.get("mode")
    )

    # ----- preferred work environment -----
    we_section = profile.get("workEnvironment") or profile.get("work_environment") or {}
    raw_we = profile.get("preferred_work_environment") or we_section.get("preferred_work_environment") or we_section.get("options")
    norm["preferred_work_environment"] = extract_any_list(raw_we)

    # ----- personality -----
    pers = profile.get("personality") or {}
    norm["personality_work_type"] = (
        profile.get("personality_work_type")
        or pers.get("work_type")
        or pers.get("type")
    )
    norm["personality_work_style"] = (
        profile.get("personality_work_style")
        or pers.get("work_style")
    )
    norm["personality_env_pref"] = (
        profile.get("personality_env_pref")
        or pers.get("env_pref")
    )
    norm["personality_stress_handling"] = (
        profile.get("personality_stress_handling")
        or pers.get("stress_handling")
    )

    # ----- salary -----
    salary_section = profile.get("salary") or profile.get("salaryExpectations") or {}
    norm["salary_expectation"] = (
        profile.get("salary_expectation")
        or salary_section.get("expectation")
        or salary_section.get("range")
    )

    return norm

# RECOMMENDER

def recommend(user_profile: dict, top_k: int = 3):
    """
    user_profile: dict from frontend (/api/get-fullinfo -> profile)
    returns: list of {career, score, top_skills}
    """

    user = normalize_user_profile(user_profile)

    user_skills   = user.get("skills", [])
    user_intr     = user.get("interests", [])
    user_str      = user.get("strengths", [])
    user_weak     = user.get("weaknesses", [])
    user_lf       = user.get("learning_formats", [])
    user_work_env = user.get("preferred_work_environment", [])

    # compute score PER ROW first, as a plain Python list
    scores = []

    for _, row in profiles.iterrows():
        row_skills    = row["skills"]
        row_intr      = row["interests"]
        row_str       = row["strengths"]
        row_weak      = row["weaknesses"]
        row_lf        = parse_list(row.get("learning_formats", []))
        row_work_env  = parse_list(row.get("preferred_work_environment", []))

        # list similarities
        s_skills    = list_similarity(user_skills, row_skills)
        s_intr      = list_similarity(user_intr, row_intr)
        s_str       = list_similarity(user_str, row_str)
        s_weak_pen  = list_penalty(user_weak, row_weak)
        s_lf        = list_similarity(user_lf, row_lf)
        s_work_env  = list_similarity(user_work_env, row_work_env)

        # scalar personality
        s_p_type   = scalar_similarity(user.get("personality_work_type"), row.get("personality_work_type"))
        s_p_style  = scalar_similarity(user.get("personality_work_style"), row.get("personality_work_style"))
        s_p_env    = scalar_similarity(user.get("personality_env_pref"), row.get("personality_env_pref"))
        s_p_stress = scalar_similarity(user.get("personality_stress_handling"), row.get("personality_stress_handling"))
        s_person   = (s_p_type + s_p_style + s_p_env + s_p_stress) / 4.0

        # scalar learning + mode
        s_lp   = scalar_similarity(user.get("learning_pace"), row.get("learning_pace"))
        s_mode = scalar_similarity(user.get("mode_preference"), row.get("mode_preference"))
        s_learn_mode = (s_lp + s_mode) / 2.0

        # salary
        s_salary = scalar_similarity(user.get("salary_expectation"), row.get("salary_expectation"))

        # final weighted score
        score = 0.0
        score += WEIGHTS["skills"]                     * s_skills
        score += WEIGHTS["interests"]                  * s_intr
        score += WEIGHTS["strengths"]                  * s_str
        score += WEIGHTS["weaknesses"]                 * s_weak_pen
        score += WEIGHTS["learning_formats"]           * s_lf
        score += WEIGHTS["preferred_work_environment"] * s_work_env
        score += WEIGHTS["scalar_personality"]         * s_person
        score += WEIGHTS["scalar_learning_mode"]       * s_learn_mode
        score += WEIGHTS["scalar_salary"]              * s_salary

        scores.append(score)

    # convert once AFTER loop
    scores = np.array(scores, dtype=float)

    if len(scores) == 0:
        return []

    # -------- aggregate by career (unique careers) --------
    career_to_best = {}
    career_to_idx = {}

    # IMPORTANT: iterate using positional index so it lines up with scores
    for idx in range(len(profiles)):
        career = profiles.iloc[idx]["target_recommended_career"]
        score = scores[idx]
        if (career not in career_to_best) or (score > career_to_best[career]):
            career_to_best[career] = score
            career_to_idx[career] = idx

    # list of (career, score, idx), sorted by score desc
    items = [
        (career, career_to_best[career], career_to_idx[career])
        for career in career_to_best
    ]
    items.sort(key=lambda x: x[1], reverse=True)

    # take top_k unique careers
    items = items[:top_k]

    # normalize scores w.r.t best one so UI gets 0–1 range
    max_score = max((s for _, s, _ in items), default=1.0)
    if max_score == 0:
        max_score = 1.0

    results = []
    for rank, (career, raw_score, idx) in enumerate(items, start=1):
        row = profiles.iloc[idx]
        row_skills = row["skills"]
        matched_skills = list(to_set(user_skills) & to_set(row_skills))
        if not matched_skills:
            matched_skills = row_skills[:5]

        results.append({
            "career": career,
            "score": float(round(raw_score / max_score, 4)),
            "top_skills": matched_skills
        })

    return results