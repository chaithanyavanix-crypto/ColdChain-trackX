"""
Geocoding and Spatial Intelligence Service.
Transforms raw coordinates into human-readable locations, landmarks, and geofence zones.
Features:
1. Instant zero-latency Geofence Zone matching for certified cold-storage hubs.
2. Nearest-area / landmark spatial resolution.
3. 100m spatial grid caching to avoid redundant API lookups.
4. Temporal Last-Known Location fallback for GNSS tunnel/indoor dropouts.
"""

from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
import math
import json
import urllib.request
import urllib.parse
from ..utils.gps_utils import haversine_km, is_valid_coordinate
from ..utils.time_utils import elapsed_seconds
from ..core.constants import GOOGLE_MAPS_API_KEY


# Catalog of Major Metropolitan Regions across India for offline/fallback geocoding
MAJOR_METRO_REGIONS = [
    {
        "name": "Mumbai Metropolitan Region",
        "city": "Mumbai",
        "state": "Maharashtra",
        "lat_min": 18.85, "lat_max": 19.45,
        "lng_min": 72.75, "lng_max": 73.20,
        "landmark": "Mumbai Western Logistics Corridor"
    },
    {
        "name": "Pune Region",
        "city": "Pune",
        "state": "Maharashtra",
        "lat_min": 18.35, "lat_max": 18.75,
        "lng_min": 73.65, "lng_max": 74.05,
        "landmark": "Pune Industrial Transit Hub"
    },
    {
        "name": "Bengaluru Urban",
        "city": "Bengaluru",
        "state": "Karnataka",
        "lat_min": 12.75, "lat_max": 13.25,
        "lng_min": 77.40, "lng_max": 77.80,
        "landmark": "Bengaluru Tech & Pharma Corridor"
    },
    {
        "name": "Delhi National Capital Region",
        "city": "New Delhi",
        "state": "Delhi",
        "lat_min": 28.35, "lat_max": 28.90,
        "lng_min": 76.85, "lng_max": 77.40,
        "landmark": "Delhi NCR North Transit Corridor"
    },
    {
        "name": "Chennai Region",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "lat_min": 12.85, "lat_max": 13.30,
        "lng_min": 79.95, "lng_max": 80.35,
        "landmark": "Chennai Port Logistics Belt"
    },
    {
        "name": "Kolkata Region",
        "city": "Kolkata",
        "state": "West Bengal",
        "lat_min": 22.35, "lat_max": 22.80,
        "lng_min": 88.20, "lng_max": 88.55,
        "landmark": "Eastern Transit Corridor"
    },
    {
        "name": "Ahmedabad Region",
        "city": "Ahmedabad",
        "state": "Gujarat",
        "lat_min": 22.85, "lat_max": 23.25,
        "lng_min": 72.40, "lng_max": 72.75,
        "landmark": "Gujarat Industrial Express Corridor"
    },
    {
        "name": "Hyderabad Region",
        "city": "Hyderabad",
        "state": "Telangana",
        "lat_min": 17.15, "lat_max": 17.65,
        "lng_min": 78.20, "lng_max": 78.65,
        "landmark": "Hyderabad Pharma & Logistics Hub"
    }
]


# Catalog of certified Cold-Chain Hubs and Geofences
CERTIFIED_GEOFENCES = [
    {
        "id": "GEO-HYD-01",
        "name": "Gachibowli Cold Storage Zone",
        "area": "Gachibowli",
        "city": "Hyderabad",
        "state": "Telangana",
        "landmark": "Near Financial District & ORR Exit 19",
        "lat": 17.4401,
        "lng": 78.3489,
        "radius_km": 2.5,
        "zone_type": "CERTIFIED_WAREHOUSE"
    },
    {
        "id": "GEO-HYD-02",
        "name": "HITEC City Logistics Depot",
        "area": "HITEC City",
        "city": "Hyderabad",
        "state": "Telangana",
        "landmark": "Near Cyber Towers & Mindspace",
        "lat": 17.4485,
        "lng": 78.3750,
        "radius_km": 2.0,
        "zone_type": "DISTRIBUTION_CENTER"
    },
    {
        "id": "GEO-HYD-03",
        "name": "Madhapur Cold Hub",
        "area": "Madhapur",
        "city": "Hyderabad",
        "state": "Telangana",
        "landmark": "Near Ayyappa Society & Durgam Cheruvu",
        "lat": 17.4483,
        "lng": 78.3915,
        "radius_km": 2.0,
        "zone_type": "DISTRIBUTION_CENTER"
    },
    {
        "id": "GEO-HYD-04",
        "name": "Kondapur Pharma Hub",
        "area": "Kondapur",
        "city": "Hyderabad",
        "state": "Telangana",
        "landmark": "Near Botanical Garden & Kothaguda",
        "lat": 17.4610,
        "lng": 78.3560,
        "radius_km": 2.0,
        "zone_type": "PHARMA_DEPOT"
    },
    {
        "id": "GEO-HYD-05",
        "name": "Genome Valley Biotech & Vaccine Park",
        "area": "Shamirpet",
        "city": "Hyderabad",
        "state": "Telangana",
        "landmark": "Genome Valley Pharma Cluster",
        "lat": 17.6080,
        "lng": 78.5850,
        "radius_km": 3.5,
        "zone_type": "BIOTECH_MANUFACTURING"
    },
    {
        "id": "GEO-HYD-06",
        "name": "Patancheru Industrial Logistics Hub",
        "area": "Patancheru",
        "city": "Hyderabad",
        "state": "Telangana",
        "landmark": "Pharma Manufacturing Belt",
        "lat": 17.5310,
        "lng": 78.2640,
        "radius_km": 3.0,
        "zone_type": "BULK_PHARMA_STORAGE"
    },
    {
        "id": "GEO-HYD-07",
        "name": "Balanagar Life Sciences Depot",
        "area": "Balanagar",
        "city": "Hyderabad",
        "state": "Telangana",
        "landmark": "Near Sanath Nagar & Moosapet",
        "lat": 17.4720,
        "lng": 78.4350,
        "radius_km": 2.0,
        "zone_type": "DISTRIBUTION_CENTER"
    },
    {
        "id": "GEO-HYD-08",
        "name": "RGIA Perishable Cold Cargo Terminal",
        "area": "Shamshabad",
        "city": "Hyderabad",
        "state": "Telangana",
        "landmark": "RGIA Airport Cargo Gate 4",
        "lat": 17.2403,
        "lng": 78.4294,
        "radius_km": 4.0,
        "zone_type": "AIRPORT_CARGO_TERMINAL"
    },
    {
        "id": "GEO-HYD-09",
        "name": "Medchal North Logistics Corridor",
        "area": "Medchal",
        "city": "Hyderabad",
        "state": "Telangana",
        "landmark": "NH-44 Cold Chain Distribution Center",
        "lat": 17.6320,
        "lng": 78.4820,
        "radius_km": 3.0,
        "zone_type": "TRANSIT_WAREHOUSE"
    },
    {
        "id": "GEO-HYD-10",
        "name": "Nanakramguda Financial District Hub",
        "area": "Nanakramguda",
        "city": "Hyderabad",
        "state": "Telangana",
        "landmark": "Near WaveRock & Financial District",
        "lat": 17.4200,
        "lng": 78.3400,
        "radius_km": 2.0,
        "zone_type": "DISTRIBUTION_CENTER"
    },
    {
        "id": "GEO-HYD-11",
        "name": "Jubilee Hills Healthcare Hub",
        "area": "Jubilee Hills",
        "city": "Hyderabad",
        "state": "Telangana",
        "landmark": "Near Apollo Health City",
        "lat": 17.4310,
        "lng": 78.4070,
        "radius_km": 2.5,
        "zone_type": "HOSPITAL_COLD_DEPOT"
    },
    {
        "id": "GEO-HYD-12",
        "name": "Banjara Hills Logistics Point",
        "area": "Banjara Hills",
        "city": "Hyderabad",
        "state": "Telangana",
        "landmark": "Road No. 12 Healthcare Cluster",
        "lat": 17.4150,
        "lng": 78.4420,
        "radius_km": 2.5,
        "zone_type": "DISTRIBUTION_CENTER"
    }
]


class GeocodingService:
    """Service providing human-readable location labels, geofencing, and last-known location."""

    # In-memory spatial cache: (rounded_lat_3dec, rounded_lng_3dec) -> address dict
    _spatial_cache: Dict[Tuple[float, float], Dict[str, Any]] = {}

    # Last known location cache: device_id -> location dict
    _last_known_locations: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def _reverse_geocode_live(cls, lat: float, lng: float) -> Dict[str, str]:
        """
        Multi-tier spatial resolver:
        Tier 1: 100m spatial RAM cache.
        Tier 2: Google Maps Geocoding API (if key available and active).
        Tier 3: OpenStreetMap Nominatim reverse geocoding.
        Tier 4: Offline Indian Metropolitan & State Corridor bounds catalog.
        Tier 5: Generic geocoordinate transit corridor.
        """
        cache_key = (round(lat, 3), round(lng, 3))
        if cache_key in cls._spatial_cache:
            return cls._spatial_cache[cache_key]

        # Tier 2: Google Maps Geocoding API
        if GOOGLE_MAPS_API_KEY:
            try:
                url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat:.6f},{lng:.6f}&key={GOOGLE_MAPS_API_KEY}"
                req = urllib.request.Request(url, headers={"User-Agent": "TracX-Fleet-Platform/2.0"})
                with urllib.request.urlopen(req, timeout=2.0) as resp:
                    data = json.loads(resp.read().decode())
                    if data.get("status") == "OK" and data.get("results"):
                        res = data["results"][0]
                        comps = res.get("address_components", [])
                        sublocality = None
                        locality = None
                        admin_area = None
                        premise = None
                        for comp in comps:
                            types = comp.get("types", [])
                            if "sublocality" in types or "sublocality_level_1" in types or "neighborhood" in types:
                                sublocality = comp.get("long_name")
                            elif "locality" in types:
                                locality = comp.get("long_name")
                            elif "administrative_area_level_2" in types and not locality:
                                locality = comp.get("long_name")
                            elif "administrative_area_level_1" in types:
                                admin_area = comp.get("long_name")
                            elif "premise" in types or "route" in types:
                                premise = comp.get("long_name")

                        city = locality or "Metropolitan Region"
                        state = admin_area or "Region"
                        area = sublocality or locality or f"{lat:.3f}°N, {lng:.3f}°E"
                        landmark = premise or f"Near {area}"
                        resolved = {
                            "area": area,
                            "city": city,
                            "state": state,
                            "landmark": landmark
                        }
                        cls._spatial_cache[cache_key] = resolved
                        return resolved
            except Exception:
                pass

        # Tier 3: OpenStreetMap Nominatim reverse geocoding
        try:
            url = f"https://nominatim.openstreetmap.org/reverse?lat={lat:.6f}&lon={lng:.6f}&format=json&zoom=14"
            req = urllib.request.Request(url, headers={"User-Agent": "TracX-SmartCCMS-Platform/2.0 (fleet-telemetry-ai)"})
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                data = json.loads(resp.read().decode())
                if data and "address" in data:
                    addr = data["address"]
                    area = addr.get("suburb") or addr.get("neighbourhood") or addr.get("village") or addr.get("town") or addr.get("county") or "Local Area"
                    city = addr.get("city") or addr.get("town") or addr.get("district") or addr.get("state_district") or "Metro Region"
                    state = addr.get("state") or "Operating Region"
                    landmark = addr.get("road") or addr.get("industrial") or f"Near {area}"
                    resolved = {
                        "area": area,
                        "city": city,
                        "state": state,
                        "landmark": landmark
                    }
                    cls._spatial_cache[cache_key] = resolved
                    return resolved
        except Exception:
            pass

        # Tier 4: Major Metropolitan & Industrial Corridors catalog
        for metro in MAJOR_METRO_REGIONS:
            if metro["lat_min"] <= lat <= metro["lat_max"] and metro["lng_min"] <= lng <= metro["lng_max"]:
                resolved = {
                    "area": metro["name"],
                    "city": metro["city"],
                    "state": metro["state"],
                    "landmark": metro["landmark"]
                }
                cls._spatial_cache[cache_key] = resolved
                return resolved

        # Tier 5: Generic geocoordinate transit corridor (truthful coordinates, never fake Hyderabad!)
        resolved = {
            "area": f"Transit Corridor ({lat:.3f}°N, {lng:.3f}°E)",
            "city": "National Transit Corridor",
            "state": "Operating Area",
            "landmark": "National Highway Transit Belt"
        }
        cls._spatial_cache[cache_key] = resolved
        return resolved

    @classmethod
    def resolve_location(
        cls,
        device_id: str,
        lat: Optional[float],
        lng: Optional[float],
        accuracy_m: Optional[float] = None,
        speed_kmh: float = 0.0,
        timestamp: Optional[datetime] = None,
        is_anomaly: bool = False
    ) -> Dict[str, Any]:
        """
        Converts coordinates into a rich operational location object.
        Falls back to last-known location if coordinates are unavailable.
        """
        now = timestamp or datetime.utcnow()

        # Check if coordinates are valid
        if not is_valid_coordinate(lat, lng):
            # Check if we have a last known location for this device
            last_known = cls._last_known_locations.get(device_id)
            if last_known:
                elapsed = elapsed_seconds(last_known["timestamp"], now)
                elapsed_str = f"{int(elapsed)}s ago" if elapsed < 60 else f"{int(elapsed // 60)}m ago"
                return {
                    "display_address": f"{last_known['area']}, {last_known['city']}",
                    "area": last_known["area"],
                    "city": last_known["city"],
                    "state": last_known["state"],
                    "sub_area": f"Last Known: {last_known['landmark']} ({elapsed_str})",
                    "landmark": last_known["landmark"],
                    "geofence": last_known["geofence"],
                    "movement_status": "SIGNAL_LOST",
                    "movement_label": "🛰️ GPS Signal Lost (Indoor / Basement)",
                    "has_fix": False,
                    "is_last_known": True,
                    "last_known_time_str": elapsed_str,
                    "accuracy_label": "Unavailable",
                    "technical_coords": f"{last_known['lat']:.4f}°N, {last_known['lng']:.4f}°E (Last Known)"
                }

            return {
                "display_address": "Acquiring GNSS Location...",
                "area": "Cold Start / Indoor",
                "city": "Acquiring Fix",
                "state": "--",
                "sub_area": "Awaiting clear view of sky",
                "landmark": "Indoor / Cold Start",
                "geofence": {
                    "is_inside": False,
                    "name": "None",
                    "zone_type": "UNKNOWN"
                },
                "movement_status": "ACQUIRING",
                "movement_label": "🛰️ Acquiring GNSS Fix",
                "has_fix": False,
                "is_last_known": False,
                "last_known_time_str": None,
                "accuracy_label": "No Data",
                "technical_coords": "-- , --"
            }

        lat_f = float(lat)
        lng_f = float(lng)

        # 0. Check Operator-Configured Dynamic Geofences (Start, Destination, Custom)
        matched_geofence = None
        try:
            from ..api.routes.trips import geofences_store
            for z_type, z_cfg in geofences_store.items():
                if z_cfg.get("lat") is not None and z_cfg.get("lng") is not None:
                    z_dist = haversine_km(lat_f, lng_f, float(z_cfg["lat"]), float(z_cfg["lng"]))
                    z_rad = float(z_cfg.get("radius_km", 2.0))
                    if z_dist <= z_rad:
                        matched_geofence = {
                            "name": z_cfg.get("zone_name") or f"Configured {z_type.capitalize()} Zone",
                            "area": z_cfg.get("zone_name") or f"{z_type.capitalize()} Zone",
                            "city": "Active Fleet Region",
                            "state": "Operating Area",
                            "landmark": f"Target Radius: {z_rad:.1f} km",
                            "zone_type": f"GEOFENCE_{z_type.upper()}"
                        }
                        break
        except Exception:
            pass

        # 1. Check Certified Geofences (Tier 1 Match)
        if not matched_geofence:
            closest_hub = None
            min_hub_dist = 999999.0

            for gf in CERTIFIED_GEOFENCES:
                dist = haversine_km(lat_f, lng_f, gf["lat"], gf["lng"])
                if dist < min_hub_dist:
                    min_hub_dist = dist
                    closest_hub = gf
                if dist <= gf["radius_km"]:
                    matched_geofence = gf
                    break

        # 2. Derive Area & Landmark
        if matched_geofence:
            area = matched_geofence["area"]
            city = matched_geofence["city"]
            state = matched_geofence["state"]
            landmark = matched_geofence["landmark"]
            geofence_info = {
                "is_inside": True,
                "name": matched_geofence["name"],
                "zone_type": matched_geofence["zone_type"]
            }
        elif closest_hub and min_hub_dist <= 5.0:
            area = closest_hub["area"]
            city = closest_hub["city"]
            state = closest_hub["state"]
            landmark = f"Near {closest_hub['area']} (~{min_hub_dist:.1f} km from {closest_hub['landmark']})"
            geofence_info = {
                "is_inside": False,
                "name": f"Outside {closest_hub['name']} ({min_hub_dist:.1f} km)",
                "zone_type": "EN_ROUTE"
            }
        else:
            # Real reverse geocoding - never fake "Hyderabad Region" for other cities!
            live_loc = cls._reverse_geocode_live(lat_f, lng_f)
            area = live_loc["area"]
            city = live_loc["city"]
            state = live_loc["state"]
            landmark = live_loc["landmark"]
            geofence_info = {
                "is_inside": False,
                "name": f"En Route • {city}",
                "zone_type": "EN_ROUTE"
            }

        # Accurate measurement without inventing fake ±8.5m
        acc_str = f"±{accuracy_m:.1f}m" if accuracy_m is not None else None

        # 3. Derive Movement Status
        if is_anomaly:
            move_status = "ANOMALY_REJECTED"
            move_label = "⚠️ Kinematic Jump Rejected (Holding Valid Fix)"
            is_last_known_flag = True
            acc_label = "Anomaly Rejected • Holding Last Valid Fix"
        elif speed_kmh >= 3.0:
            move_status = "MOVING"
            move_label = f"🚚 Moving • {speed_kmh:.1f} km/h"
            is_last_known_flag = False
            acc_label = f"GPS Active • {acc_str}" if acc_str else "GPS Active (3D Fix)"
        else:
            move_status = "STATIONARY"
            move_label = "🅿️ Stationary (Parked)"
            is_last_known_flag = False
            acc_label = f"GPS Active • {acc_str}" if acc_str else "GPS Active (3D Fix)"

        # Accurate measurement without inventing fake ±8.5m
        display_address = f"{area}, {city}"
        sub_area = f"{landmark} • {state}"

        result = {
            "display_address": display_address,
            "area": area,
            "city": city,
            "state": state,
            "sub_area": sub_area,
            "landmark": landmark,
            "geofence": geofence_info,
            "movement_status": move_status,
            "movement_label": move_label,
            "has_fix": True,
            "is_last_known": is_last_known_flag,
            "last_known_time_str": None,
            "accuracy_label": acc_label,
            "technical_coords": f"{lat_f:.4f}°N, {lng_f:.4f}°E"
        }

        # Save to last known locations only if this was a valid, non-anomalous fix
        if not is_anomaly:
            cls._last_known_locations[device_id] = {
                "lat": lat_f,
                "lng": lng_f,
                "area": area,
                "city": city,
                "state": state,
                "landmark": landmark,
                "geofence": geofence_info,
                "timestamp": now
            }

        return result
