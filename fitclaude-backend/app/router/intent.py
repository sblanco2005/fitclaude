"""Intent detection — routes messages to the correct agent."""

import re

# ─── Food logging intent ──────────────────────────────────────────────────────

# Patterns that indicate food LOGGING (route to nutrition agent)
_FOOD_LOG_PATTERNS = [
    # Explicit logging verbs
    r"\b(log|track|add)\b.{0,20}\b(food|meal|calories|macros|nutrition|what i ate)\b",
    # Past tense eating
    r"\b(ate|had|just had|just ate|consumed|eating|drank|drinking)\b",
    # Meal context
    r"\bfor\s+(breakfast|lunch|dinner|snack|pre.?workout|post.?workout)\b",
    # Quantity + food unit
    r"\b\d+\s*(eggs?|scoops?|slices?|cups?|oz|g\b|pieces?|servings?|strips?|shakes?)",
    # Known food brands
    r"\b(nurri|chipotle|quest|fairlife|oikos|kirkland)\b",
    # Common foods stated plainly (not as a question)
    r"^(?!.*\b(how|what is|calories in|nutrition info|recommend|suggest|should i)\b)"
    r".*\b(protein shake|chicken breast|oatmeal|bagel|banana|eggs? and|rice and|"
    r"steak|jerky|yogurt|cereal|sandwich|burrito|wrap|pizza|pasta|salad)\b",
]

# Patterns that should NOT be routed to nutrition agent
_FOOD_QUESTION_PATTERNS = [
    r"\b(how (to|do|can)|what is|what are|calories in|nutrition info|"
    r"recommend|suggest|should i eat|meal plan|meal prep|"
    r"delete log|remove entry|undo last|edit my)\b",
]

_food_log_re = [re.compile(p, re.IGNORECASE) for p in _FOOD_LOG_PATTERNS]
_food_question_re = [re.compile(p, re.IGNORECASE) for p in _FOOD_QUESTION_PATTERNS]


def detect_food_logging_intent(message: str) -> bool:
    """Determine if a message should be routed to the nutrition agent."""
    # First check exclusions — questions about food should go to general handler
    for pat in _food_question_re:
        if pat.search(message):
            return False

    # Then check if it looks like food logging
    for pat in _food_log_re:
        if pat.search(message):
            return True

    return False


# ─── Shortcode intent ────────────────────────────────────────────────────────

_SHORTCODE_RE = re.compile(
    r"^(?:log\s+)?#(\w+)(?:\s+(\d+(?:\.\d+)?))?$", re.IGNORECASE
)


def detect_shortcode_intent(message: str) -> dict | None:
    """Detect shortcode logging like '#fieldtrip 3' or 'Log #nurri'.

    Returns {"shortcode": "fieldtrip", "quantity": 3.0} or None.
    """
    m = _SHORTCODE_RE.match(message.strip())
    if m:
        return {
            "shortcode": m.group(1).lower(),
            "quantity": float(m.group(2)) if m.group(2) else 1.0,
        }
    return None
