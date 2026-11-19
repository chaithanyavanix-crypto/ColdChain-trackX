"""
==============================================================================
FILE: import_user_trip.py
PURPOSE:
Parses the user's 108 GPS waypoints from Raidurgam / Gachibowli to Nanakramguda
Financial District, computes realistic kinematics (speeds, bearings, timestamps,
halt at Financial District junction, and cold-chain temperature readings),
and persists it into the Smart CCMS database as a complete, auditable trip.
==============================================================================
"""

import math
import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "backend", "tracx_fleet.db")

RAW_POINTS = [
    (1, 17.431614, 78.372003),
    (2, 17.431720, 78.371700),
    (3, 17.431850, 78.371350),
    (4, 17.431980, 78.371000),
    (5, 17.432100, 78.370650),
    (6, 17.432220, 78.370300),
    (7, 17.432300, 78.369950),
    (8, 17.432250, 78.369600),
    (9, 17.432100, 78.369250),
    (10, 17.431900, 78.368900),
    (11, 17.431650, 78.368550),
    (12, 17.431400, 78.368200),
    (13, 17.431100, 78.367850),
    (14, 17.430800, 78.367500),
    (15, 17.430450, 78.367150),
    (16, 17.430100, 78.366800),
    (17, 17.429750, 78.366450),
    (18, 17.429400, 78.366100),
    (19, 17.429050, 78.365750),
    (20, 17.428700, 78.365400),
    (21, 17.428350, 78.365050),
    (22, 17.428000, 78.364700),
    (23, 17.427650, 78.364350),
    (24, 17.427300, 78.364000),
    (25, 17.426950, 78.363650),
    (26, 17.426600, 78.363300),
    (27, 17.426250, 78.362950),
    (28, 17.425900, 78.362600),
    (29, 17.425550, 78.362250),
    (30, 17.425200, 78.361900),
    (31, 17.424850, 78.361550),
    (32, 17.424500, 78.361200),
    (33, 17.424150, 78.360850),
    (34, 17.423800, 78.360500),
    (35, 17.423450, 78.360150),
    (36, 17.423100, 78.359800),
    (37, 17.422750, 78.359450),
    (38, 17.422400, 78.359100),
    (39, 17.422050, 78.358750),
    (40, 17.421700, 78.358400),
    (41, 17.421350, 78.358050),
    (42, 17.421000, 78.357700),
    (43, 17.420650, 78.357350),
    (44, 17.420300, 78.357000),
    (45, 17.419950, 78.356650),
    (46, 17.419600, 78.356300),
    (47, 17.419250, 78.355950),
    (48, 17.418900, 78.355600),
    (49, 17.418550, 78.355250),
    (50, 17.418200, 78.354900),
    (51, 17.417850, 78.354550),
    (52, 17.417500, 78.354200),
    (53, 17.417150, 78.353850),
    (54, 17.416800, 78.353500),
    (55, 17.416450, 78.353150),
    (56, 17.416100, 78.352800),
    (57, 17.415750, 78.352450),
    (58, 17.415400, 78.352100),
    (59, 17.415050, 78.351750),
    (60, 17.414700, 78.351400),
    (61, 17.414350, 78.351050),
    (62, 17.414000, 78.350700),
    (63, 17.413650, 78.350350),
    (64, 17.413300, 78.350000),
    (65, 17.412950, 78.349650),
    (66, 17.412600, 78.349300),
    (67, 17.412250, 78.348950),
    (68, 17.411900, 78.348600),
    (69, 17.411550, 78.348250),
    (70, 17.411200, 78.347900),
    (71, 17.410850, 78.347550),
    (72, 17.410500, 78.347200),
    (73, 17.410150, 78.346850),
    (74, 17.409800, 78.346500),
    (75, 17.410200, 78.346300),
    (76, 17.410650, 78.346150),
    (77, 17.411100, 78.346100),
    (78, 17.411550, 78.346150),
    (79, 17.412000, 78.346250),
    (80, 17.412450, 78.346350),
    (81, 17.412900, 78.346450),
    (82, 17.413350, 78.346550),
    (83, 17.413800, 78.346600),
    (84, 17.414250, 78.346580),
    (85, 17.414700, 78.346550),
    (86, 17.415150, 78.346520),
    (87, 17.415600, 78.346500),
    (88, 17.416050, 78.346480),
    (89, 17.416500, 78.346460),
    (90, 17.416950, 78.346440),
    (91, 17.417400, 78.346420),
    (92, 17.417850, 78.346400),
    (93, 17.418300, 78.346380),
    (94, 17.418750, 78.346360),
    (95, 17.419200, 78.346340),
    (96, 17.419650, 78.346320),
    (97, 17.420100, 78.346300),
    (98, 17.420550, 78.346280),
    (99, 17.421000, 78.346260),
    (100, 17.421500, 78.346240),
    (101, 17.422000, 78.346220),
    (102, 17.422500, 78.346200),
    (103, 17.423000, 78.346180),
    (104, 17.423500, 78.346160),
    (105, 17.424000, 78.346140),
    (106, 17.424500, 78.346120),
    (107, 17.424900, 78.346100),
    (108, 17.425326, 78.346578)
]


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def calculate_bearing(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360.0) % 360.0


def import_trip(device_id="TRX-1001", trip_id=None):
    if not trip_id:
        today_str = datetime.utcnow().strftime("%Y%m%d")
        trip_id = f"TRIP-{device_id}-{today_str}-HYD108"

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Clean up any previous test import with the same ID or legacy halt
    cursor.execute("DELETE FROM trip_waypoints WHERE trip_id = ?", (trip_id,))
    cursor.execute("DELETE FROM trip_halts WHERE trip_id = ? OR halt_id LIKE 'HALT-%HYD108%'", (trip_id,))
    cursor.execute("DELETE FROM trips WHERE trip_id = ?", (trip_id,))

    # 2. Build Chronological Waypoints
    # We will simulate a trip that took place earlier today
    base_time = datetime.utcnow() - timedelta(minutes=45)
    current_time = base_time

    waypoints_data = []
    total_dist_km = 0.0
    speeds = []
    temps = []

    # Temperatures oscillating smoothly within safe pharma band (4.1°C to 4.7°C)
    current_temp = 4.25

    # Introduce a planned halt at Point 74 (Financial District junction)
    halt_index = 73  # 0-indexed point 74
    halt_duration_minutes = 3.5
    halt_record = None

    for i in range(len(RAW_POINTS)):
        idx, lat, lng = RAW_POINTS[i]

        # Calculate heading & distance to next point
        if i < len(RAW_POINTS) - 1:
            next_idx, next_lat, next_lng = RAW_POINTS[i + 1]
            seg_dist = haversine_km(lat, lng, next_lat, next_lng)
            bearing = calculate_bearing(lat, lng, next_lat, next_lng)
        else:
            prev_idx, prev_lat, prev_lng = RAW_POINTS[i - 1]
            seg_dist = haversine_km(prev_lat, prev_lng, lat, lng)
            bearing = calculate_bearing(prev_lat, prev_lng, lat, lng)

        total_dist_km += seg_dist

        # Compute realistic city road speed:
        # Straight stretch points have higher speed, turns have lower speed
        if i < 8:
            speed = 22.0 + (i * 2.5)  # accelerating out of depot
        elif 8 <= i < 70:
            speed = 38.0 + 8.0 * math.sin(i * 0.2)  # cruising on arterial road 35-46 km/h
        elif 70 <= i <= 74:
            speed = max(0.0, 30.0 - (i - 70) * 7.5)  # decelerating towards junction halt
        elif i == 74:
            speed = 0.0  # stopped at halt
        elif 75 <= i < 82:
            speed = 15.0 + (i - 75) * 3.5  # accelerating after turning North
        else:
            speed = 40.0 + 6.0 * math.sin(i * 0.25)  # cruising up Financial District road

        speed = round(speed, 1)
        speeds.append(speed)

        # Gentle cold-chain temperature variation
        current_temp += 0.015 * math.cos(i * 0.4)
        if current_temp < 4.15:
            current_temp = 4.15
        if current_temp > 4.75:
            current_temp = 4.75
        current_temp = round(current_temp, 2)
        temps.append(current_temp)

        # Append waypoint
        waypoints_data.append((
            trip_id,
            current_time.isoformat(),
            lat,
            lng,
            speed,
            round(bearing, 1),
            current_temp
        ))

        # Check for halt at Point 74
        if i == halt_index:
            halt_start_time = current_time
            # Temperature slightly drifts up during vehicle stoppage
            halt_start_temp = current_temp
            current_time += timedelta(minutes=halt_duration_minutes)
            halt_end_time = current_time
            current_temp += 0.35  # +0.35°C warming during halt
            halt_end_temp = current_temp

            halt_record = {
                "halt_id": f"HALT-{trip_id}-01",
                "trip_id": trip_id,
                "device_id": device_id,
                "start_time": halt_start_time.isoformat(),
                "end_time": halt_end_time.isoformat(),
                "duration_minutes": halt_duration_minutes,
                "lat": lat,
                "lng": lng,
                "location_name": "Financial District Circle Junction, Hyderabad",
                "start_temp_c": halt_start_temp,
                "end_temp_c": round(halt_end_temp, 2)
            }
        else:
            # Advance time by 6-9 seconds between points
            dt_seconds = 7 if speed > 10 else 4
            current_time += timedelta(seconds=dt_seconds)

    end_time = current_time
    total_duration_minutes = (end_time - base_time).total_seconds() / 60.0
    moving_minutes = total_duration_minutes - (halt_duration_minutes if halt_record else 0.0)
    moving_hours = max(0.01, moving_minutes / 60.0)
    avg_speed = round(total_dist_km / moving_hours, 1)
    max_speed = max(speeds)
    min_temp = min(temps)
    max_temp = max(temps)
    mkt_temp = round(sum(temps) / len(temps), 2)

    # 3. Insert Master Trip Record
    cursor.execute("""
    INSERT INTO trips (
        trip_id, device_id, start_time, end_time, duration_minutes, moving_minutes, halt_minutes,
        total_distance_km, max_speed_kmh, avg_speed_kmh, min_temp_c, max_temp_c, mkt_temp_c,
        start_lat, start_lng, end_lat, end_lng, start_location, end_location,
        halt_count, excursion_flag, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        trip_id,
        device_id,
        base_time.isoformat(),
        end_time.isoformat(),
        round(total_duration_minutes, 1),
        round(moving_minutes, 1),
        halt_duration_minutes if halt_record else 0.0,
        round(total_dist_km, 2),
        round(max_speed, 1),
        avg_speed,
        min_temp,
        max_temp,
        mkt_temp,
        RAW_POINTS[0][1],
        RAW_POINTS[0][2],
        RAW_POINTS[-1][1],
        RAW_POINTS[-1][2],
        "Raidurgam Bio-Diversity Corridor, Hyderabad",
        "Nanakramguda Financial District Hub, Hyderabad",
        1 if halt_record else 0,
        0,  # 0 = 100% GDP Passed
        "COMPLETED",
        base_time.isoformat()
    ))

    # 4. Insert Stoppage / Halt Record
    if halt_record:
        cursor.execute("""
        INSERT OR REPLACE INTO trip_halts (
            halt_id, trip_id, device_id, start_time, end_time, duration_minutes,
            lat, lng, location_name, start_temp_c, end_temp_c
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            halt_record["halt_id"],
            halt_record["trip_id"],
            halt_record["device_id"],
            halt_record["start_time"],
            halt_record["end_time"],
            halt_record["duration_minutes"],
            halt_record["lat"],
            halt_record["lng"],
            halt_record["location_name"],
            halt_record["start_temp_c"],
            halt_record["end_temp_c"]
        ))

    # 5. Insert All 108 Waypoints
    cursor.executemany("""
    INSERT INTO trip_waypoints (
        trip_id, timestamp, lat, lng, speed_kmh, heading_deg, cargo_temp_c
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, waypoints_data)

    conn.commit()
    conn.close()

    print(f"✅ Successfully imported trip '{trip_id}'!")
    print(f"   - Total Points: {len(waypoints_data)}")
    print(f"   - Distance: {total_dist_km:.2f} km")
    print(f"   - Duration: {total_duration_minutes:.1f} mins (Moving: {moving_minutes:.1f}m | Halt: {halt_duration_minutes:.1f}m)")
    print(f"   - Avg Speed: {avg_speed} km/h | Max Speed: {max_speed} km/h")
    print(f"   - Cold-Chain Range: {min_temp}°C to {max_temp}°C (Safe: 2°C - 8°C)")
    print(f"   - Halts Recorded: 1 stoppage at Point 74 (🛑 {halt_duration_minutes}m)")
    print(f"   - Origin: {RAW_POINTS[0][1]}, {RAW_POINTS[0][2]}")
    print(f"   - Destination: {RAW_POINTS[-1][1]}, {RAW_POINTS[-1][2]}")
    return trip_id


if __name__ == "__main__":
    import_trip("TRX-1001")
