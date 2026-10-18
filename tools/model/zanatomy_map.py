"""Z-Anatomy object names (without the .l/.r suffix) -> canonical muscle group.

Patterns are case-insensitive regexes matched against the whole base name. Bursae, tendon
sheaths and most fasciae are excluded; the iliotibial tract and plantar aponeurosis are kept
because they are the structures people stretch.
"""
import re

GROUPS = {
    "hamstrings": [r"long head of biceps femoris", r"short head of biceps femoris", r"semitendinosus muscle",
                   r"semimembranosus muscle"],
    "quadriceps": [r"rectus femoris muscle", r"vastus (lateralis|medialis|intermedius) muscle"],
    "hip_flexors": [r"iliacus muscle", r"psoas major", r"sartorius muscle"],
    "glutes": [r"gluteus maximus muscle"],
    "adductors": [r"adductor (longus|brevis|magnus)", r"\(adductor minimus\)", r"gracilis muscle", r"pectineus muscle"],
    "abductors": [r"gluteus (medius|minimus) muscle", r"tensor fasciae latae"],
    "it_band": [r"iliotibial tract"],
    "piriformis": [r"piriformis muscle"],
    "calves": [r"(medial|lateral) head of gastrocnemius", r"plantaris muscle"],
    "soleus": [r"soleus muscle"],
    "tibialis_anterior": [r"tibialis anterior muscle"],
    "foot_flexors": [r"plantar aponeurosis", r"flexor digitorum brevis", r"abductor hallucis",
                     r"abductor digiti minimi of foot", r"quadratus plantae muscle",
                     r"(medial|lateral) head of flexor hallucis brevis", r"flexor digiti minimi of foot",
                     r"lumbrical muscles of foot"],
    "lower_back": [r"iliocostalis (lumborum|thoracis) muscle", r"longissimus thoracis muscle",
                   r"spinalis thoracis muscle", r"multifidus (lumborum|thoracis) muscle", r"quadratus lumborum muscle"],
    "lats": [r"latissimus dorsi muscle"],
    "upper_back": [r"rhomboid (major|minor) muscle", r"infraspinatus muscle", r"supraspinatus muscle",
                   r"teres (major|minor) muscle"],
    "traps": [r"(descending|transverse|ascending) part of trapezius muscle"],
    "neck": [r"sternocleidomastoid muscle", r"splenius (capitis|colli) muscle", r"levator scapulae",
             r"scalenus (anterior|medius|posterior) muscle"],
    "chest": [r"\(abdominal part of pectoralis major muscle\)", r"clavicular head of pectoralis major muscle",
              r"sternocostal head of pectoralis major muscle", r"pectoralis minor muscle"],
    "front_delts": [r"clavicular part of deltoid muscle"],
    "side_delts": [r"acromial part of deltoid muscle"],
    "rear_delts": [r"scapular spinal part of deltoid muscle"],
    "biceps": [r"(long|short) head of biceps brachii", r"brachialis muscle", r"coracobrachialis muscle"],
    "triceps": [r"(long|lateral|medial) head of triceps brachii", r"anconeus muscle"],
    "forearm_flexors": [r"flexor carpi radialis", r"(humeral|ulnar) head of flexor carpi ulnaris", r"palmaris longus muscle",
                        r"(humero-ulnar|radial) head of flexor digitorum superficialis", r"flexor digitorum profundus",
                        r"(deep|superficial) head of pronator teres", r"flexor pollicis longus"],
    "forearm_extensors": [r"extensor carpi radialis (longus|brevis)", r"(humeral|ulnar) head of extensor carpi ulnaris",
                          r"extensor digitorum", r"extensor digiti minimi", r"brachioradialis muscle", r"supinator",
                          r"abductor pollicis longus", r"extensor pollicis (longus|brevis)", r"extensor indicis"],
    "abs": [r"rectus abdominis muscle", r"pyramidalis muscle"],
    "obliques": [r"external abdominal oblique muscle", r"internal abdominal oblique muscle"],
}

_COMPILED = [(g, re.compile(rf"^(?:{'|'.join(p)})$", re.I)) for g, p in GROUPS.items()]


def group_for(base_name):
    for g, rx in _COMPILED:
        if rx.match(base_name):
            return g
    return None
