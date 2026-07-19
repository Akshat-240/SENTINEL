class PermitAgent:
    """
    Permit Agent
    Checks active permits vs zone conditions.
    Blocks dangerous permit combinations.
    """
    def __init__(self):
        pass

    def evaluate_permits(self, zone_snapshot):
        """
        Evaluates active permits against current zone conditions.
        Returns block decision and detected dangerous overlaps.
        """
        active_permits = zone_snapshot.get("active_permits", [])
        gas = zone_snapshot.get("gas_ppm", 0.0)
        
        types = [p.get("type", "").upper().replace(" ", "_") for p in active_permits]
        overlaps = []
        block = False
        
        # Check overlaps
        if "HOT_WORK" in types and "CONFINED_SPACE" in types:
            overlaps.append("hot_work_confined_space_overlap")
            if gas > 300:
                block = True
                
        if "HOT_WORK" in types and gas > 500:
            overlaps.append("hot_work_during_gas_leak")
            block = True
            
        if "ELECTRICAL" in types and gas > 200:
            overlaps.append("electrical_during_gas_leak")
            block = True
            
        return {
            "block": block,
            "overlaps": overlaps,
            "active_count": len(active_permits)
        }
