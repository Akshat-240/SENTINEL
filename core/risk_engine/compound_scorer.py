import os
import sys

# Ensure the project root is in sys.path to allow importing config
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings

def check_hot_work_gas(active_permits, gas_ppm):
    """
    Detects the highly dangerous combination of open flames/sparks (Hot Work)
    and high gas concentrations. 
    Real-world danger: This represents an immediate explosion or fire risk.
    """
    types = [p.get("type", "").upper().replace(" ", "_") for p in active_permits]
    if "HOT_WORK" in types and gas_ppm > settings.GAS_HIGH:  # > 500
        return settings.BONUS_HOT_WORK_GAS
    return 0

def check_confined_gas(active_permits, gas_ppm):
    """
    Detects toxic or combustible gas buildup in a confined space.
    Real-world danger: Workers in confined spaces have limited ventilation and 
    escape routes, making even moderate gas levels potentially lethal.
    """
    types = [p.get("type", "").upper().replace(" ", "_") for p in active_permits]
    if "CONFINED_SPACE" in types and gas_ppm > 300:
        return settings.BONUS_CONFINED_GAS
    return 0

def check_workers_heat(worker_count, temperature):
    """
    Detects high worker density in extreme heat conditions.
    Real-world danger: Multiple workers in a high-temperature zone increases the likelihood
    of heat exhaustion or heat stroke, potentially overwhelming emergency response.
    """
    if worker_count > settings.WORKER_HIGH_COUNT and temperature > settings.TEMP_HIGH:  # > 3, > 60
        return settings.BONUS_WORKERS_HEAT
    return 0

def check_triple_threat(active_permits, gas_ppm):
    """
    Detects the simultaneous presence of Hot Work, Confined Space, and elevated gas.
    Real-world danger: This is a catastrophic failure scenario where a confined space 
    contains an ignition source and dangerous gas levels. Immediate evacuation is required.
    """
    types = [p.get("type", "").upper().replace(" ", "_") for p in active_permits]
    if "HOT_WORK" in types and "CONFINED_SPACE" in types and gas_ppm > 300:
        return settings.BONUS_TRIPLE_THREAT
    return 0

def check_electrical_gas(active_permits, gas_ppm):
    """
    Detects electrical work occurring in the presence of moderate gas levels.
    Real-world danger: Electrical arcing or sparking can ignite gases. The risk threshold 
    is lower for electrical work as sparks are often unpredictable.
    """
    types = [p.get("type", "").upper().replace(" ", "_") for p in active_permits]
    if "ELECTRICAL" in types and gas_ppm > settings.GAS_MEDIUM:  # > 200
        return settings.BONUS_ELECTRICAL_GAS
    return 0

def check_night_shift(shift_type, base_total):
    """
    Detects elevated baseline risks occurring during the night shift.
    Real-world danger: Night shifts typically have fewer supervisory staff, reduced visibility, 
    and higher worker fatigue, making any existing risk inherently more dangerous.
    """
    if shift_type == "NIGHT" and base_total > 50:
        return settings.BONUS_NIGHT_SHIFT
    return 0

def get_compound_bonus(zone_snapshot, base_total):
    """
    Evaluates all compound risk scenarios for a zone and calculates a total bonus.
    Returns a dictionary mapping each check to its bonus value, along with the total
    and a list of triggered combination names.
    """
    active_permits = zone_snapshot.get("active_permits", [])
    gas_ppm = zone_snapshot.get("gas_ppm", 0.0)
    worker_count = zone_snapshot.get("worker_count", 0)
    temperature = zone_snapshot.get("temperature", 0.0)
    shift_type = zone_snapshot.get("shift_type", "DAY")

    hw_gas = check_hot_work_gas(active_permits, gas_ppm)
    conf_gas = check_confined_gas(active_permits, gas_ppm)
    work_heat = check_workers_heat(worker_count, temperature)
    triple = check_triple_threat(active_permits, gas_ppm)
    elec_gas = check_electrical_gas(active_permits, gas_ppm)
    night = check_night_shift(shift_type, base_total)

    total_bonus = hw_gas + conf_gas + work_heat + triple + elec_gas + night
    
    combinations_detected = []
    if hw_gas > 0:
        combinations_detected.append("hot_work_gas")
    if conf_gas > 0:
        combinations_detected.append("confined_gas")
    if work_heat > 0:
        combinations_detected.append("workers_heat")
    if triple > 0:
        combinations_detected.append("triple_threat")
    if elec_gas > 0:
        combinations_detected.append("electrical_gas")
    if night > 0:
        combinations_detected.append("night_shift")

    return {
        "hot_work_gas": hw_gas,
        "confined_gas": conf_gas,
        "workers_heat": work_heat,
        "triple_threat": triple,
        "electrical_gas": elec_gas,
        "night_shift": night,
        "total_bonus": total_bonus,
        "combinations_detected": combinations_detected
    }
