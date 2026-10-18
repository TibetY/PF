"""Canonical muscle groups. The order is the contract with the app (src/body/muscles.ts):
vertex attribute value = 1 + index * 2 + (0 for left, 1 for right); 0 = no muscle."""
MUSCLES = [
    "hamstrings", "quadriceps", "hip_flexors", "glutes", "adductors", "abductors", "it_band",
    "piriformis", "calves", "soleus", "tibialis_anterior", "foot_flexors", "lower_back", "lats",
    "upper_back", "traps", "neck", "chest", "front_delts", "side_delts", "rear_delts", "biceps",
    "triceps", "forearm_flexors", "forearm_extensors", "abs", "obliques",
]


def code(name, side):
    """side: 'l' or 'r' (the body's own left/right)."""
    return 1 + MUSCLES.index(name) * 2 + (0 if side == "l" else 1)
