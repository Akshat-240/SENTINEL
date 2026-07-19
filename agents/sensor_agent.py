class SensorAgent:
    """
    Sensor Agent
    Watches all sensor + CCTV streams.
    Flags raw anomalies.
    """
    def __init__(self):
        pass

    def inspect_zone(self, zone_snapshot):
        """
        Inspects the sensor and CCTV streams for raw anomalies.
        Returns a list of detected anomalies.
        """
        anomalies = []
        gas = zone_snapshot.get("gas_ppm", 0.0)
        temp = zone_snapshot.get("temperature", 0.0)
        pressure = zone_snapshot.get("pressure", 0.0)
        cctv_worker_count = zone_snapshot.get("cctv_worker_count", 0)
        ppe_compliant_count = zone_snapshot.get("ppe_compliant_count", 0)
        
        if gas > 200:
            anomalies.append({
                "factor": "gas",
                "value": gas,
                "message": f"Elevated gas levels detected: {gas} PPM"
            })
        if temp > 40:
            anomalies.append({
                "factor": "temperature",
                "value": temp,
                "message": f"Elevated ambient temperature: {temp}°C"
            })
        if cctv_worker_count > ppe_compliant_count:
            anomalies.append({
                "factor": "ppe",
                "value": cctv_worker_count - ppe_compliant_count,
                "message": f"PPE violation: {cctv_worker_count - ppe_compliant_count} workers non-compliant"
            })
            
        return anomalies
