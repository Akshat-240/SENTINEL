import os
import sys
import json

# Ensure the project root is in sys.path to allow importing config
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

REGULATORY_RULES = [
  {
    "rule_id": "OISD-116-4.2",
    "regulation": "OISD 116 Section 4.2",
    "description": "Hot work prohibited when gas exceeds 10% LEL",
    "condition": "hot_work_permit AND gas_ppm > 300",
    "action": "BLOCK"
  },
  {
    "rule_id": "FACTORY-ACT-36",
    "regulation": "Factory Act Section 36",
    "description": "Confined space entry requires gas clearance certificate",
    "condition": "confined_space_permit AND gas_ppm > 200",
    "action": "BLOCK"
  },
  {
    "rule_id": "OISD-GDN-192",
    "regulation": "OISD-GDN-192",
    "description": "No simultaneous hot work and confined space entry in the same zone",
    "condition": "hot_work_permit AND confined_space_permit",
    "action": "BLOCK"
  },
  {
    "rule_id": "DGMS-2019-04",
    "regulation": "DGMS Circular 2019-04",
    "description": "Electrical work prohibited when gas exceeds 5% LEL",
    "condition": "electrical_permit AND gas_ppm > 150",
    "action": "BLOCK"
  },
  {
    "rule_id": "FACTORY-ACT-21",
    "regulation": "Factory Act Section 21",
    "description": "Worker count exceeds safe zone capacity during high temperature",
    "condition": "worker_count > max_workers AND temperature > 55",
    "action": "WARNING"
  }
]

def get_max_workers(zone_id):
    """
    Reads the max_workers capacity for a specific zone from zones.json.
    """
    zones_path = os.path.join(PROJECT_ROOT, "config", "zones.json")
    try:
        with open(zones_path, 'r') as f:
            zones_data = json.load(f)
            for z in zones_data:
                if z.get("zone_id") == zone_id:
                    return z.get("max_workers", 1)
    except Exception:
        pass
    return 1

def evaluate_condition(condition_str, permit_type, zone_snapshot):
    """
    Pure Python rule engine that evaluates human-readable rule conditions
    against the current zone state and requested permit type.
    """
    gas_ppm = float(zone_snapshot.get("gas_ppm", 0.0))
    temperature = float(zone_snapshot.get("temperature", 0.0))
    worker_count = int(zone_snapshot.get("worker_count", 0))
    zone_id = zone_snapshot.get("zone_id")
    max_workers = get_max_workers(zone_id)
    
    # Aggregate existing active permits
    active_types = [p.get("type", "").upper().replace(" ", "_") for p in zone_snapshot.get("active_permits", [])]

    # Add the requested permit type to the check pool if it isn't there
    permit_type_norm = permit_type.upper().replace(" ", "_") if permit_type else None
    if permit_type_norm and permit_type_norm not in active_types:
        active_types.append(permit_type_norm)
        
    has_hot_work = "HOT_WORK" in active_types
    has_confined = "CONFINED_SPACE" in active_types
    has_electrical = "ELECTRICAL" in active_types
    
    # Evaluate specific rule logic based on string
    if condition_str == "hot_work_permit AND gas_ppm > 300":
        return has_hot_work and gas_ppm > 300
    elif condition_str == "confined_space_permit AND gas_ppm > 200":
        return has_confined and gas_ppm > 200
    elif condition_str == "hot_work_permit AND confined_space_permit":
        return has_hot_work and has_confined
    elif condition_str == "electrical_permit AND gas_ppm > 150":
        return has_electrical and gas_ppm > 150
    elif condition_str == "worker_count > max_workers AND temperature > 55":
        return worker_count > max_workers and temperature > 55
        
    return False

def check_permit_request(permit_type, zone_snapshot):
    """
    Checks all relevant rules against the current zone snapshot for a specific permit type.
    Returns the approval decision along with any violated rules or warnings.
    """
    violations = []
    warnings = []
    
    for rule in REGULATORY_RULES:
        if evaluate_condition(rule["condition"], permit_type, zone_snapshot):
            if rule["action"] == "BLOCK":
                violations.append(rule)
            elif rule["action"] == "WARNING":
                warnings.append(rule)
                
    if violations:
        decision = "BLOCKED"
        reason = f"Blocked due to {len(violations)} regulatory violation(s)."
    elif warnings:
        decision = "APPROVED_WITH_WARNING"
        reason = f"Approved with {len(warnings)} warning(s)."
    else:
        decision = "APPROVED"
        reason = "All regulatory checks passed."
        
    return {
        "permit_type": permit_type,
        "zone_id": zone_snapshot.get("zone_id"),
        "decision": decision,
        "violations": violations,
        "warnings": warnings,
        "reason": reason
    }

def check_all_active_permits(zone_snapshot):
    """
    Checks every active permit currently existing in the zone_snapshot against the rules.
    Returns a list of check results.
    """
    results = []
    active_permits = zone_snapshot.get("active_permits", [])
    
    for permit in active_permits:
        p_type_raw = permit.get("type", "")
        p_type = p_type_raw.upper().replace(" ", "_")
        results.append(check_permit_request(p_type, zone_snapshot))
        
    return results

def get_compliance_status(zone_snapshot):
    """
    Runs compliance checks on all active permits and general zone conditions.
    Aggregates unique violations and warnings into a single compliance report.
    """
    results = check_all_active_permits(zone_snapshot)
    
    # We also check the zone generally (permit_type=None) to catch purely environmental 
    # rules like the Factory Act worker capacity constraint.
    results.append(check_permit_request(None, zone_snapshot))
    
    violations = []
    violation_ids = set()
    warnings_count = 0
    warning_ids = set()
    
    for r in results:
        for v in r["violations"]:
            if v["rule_id"] not in violation_ids:
                violation_ids.add(v["rule_id"])
                violations.append(v)
        for w in r["warnings"]:
            if w["rule_id"] not in warning_ids:
                warning_ids.add(w["rule_id"])
                warnings_count += 1
                
    return {
        "zone_id": zone_snapshot.get("zone_id"),
        "compliant": len(violations) == 0,
        "violations_count": len(violations),
        "violations": violations,
        "warnings_count": warnings_count
    }
