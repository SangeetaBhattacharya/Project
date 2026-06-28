import csv
import re
import sqlite3
import threading
import time
from datetime import datetime
from pathlib import Path

import serial
from flask import Flask, jsonify, redirect, render_template, request, send_file, url_for

APP_DIR = Path(__file__).resolve().parent
DB_PATH = APP_DIR / "readings.db"
CSV_EXPORT_PATH = APP_DIR / "urine_readings_export.csv"

app = Flask(__name__)

reader_thread = None
stop_event = threading.Event()
reader_status = {
    "running": False,
    "port": "",
    "baud": 115200,
    "last_line": "",
    "last_error": "",
    "started_at": "",
}


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                received_at TEXT NOT NULL,
                device_time_ms INTEGER,
                volume_ml REAL,
                pulses INTEGER,
                turbidity_raw INTEGER,
                vout REAL,
                vin REAL,
                status TEXT,
                raw_line TEXT NOT NULL
            )
            """
        )
        conn.commit()


def insert_reading(data):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO readings (
                received_at, device_time_ms, volume_ml, pulses,
                turbidity_raw, vout, vin, status, raw_line
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.now().isoformat(timespec="seconds"),
                data.get("device_time_ms"),
                data.get("volume_ml"),
                data.get("pulses"),
                data.get("turbidity_raw"),
                data.get("vout"),
                data.get("vin"),
                data.get("status"),
                data.get("raw_line", ""),
            ),
        )
        conn.commit()


def parse_sensor_line(line):
    """
    Parse either CSV output or labelled Serial output.

    Supported CSV:
      time_ms,volume_ml,pulses,turbidity_raw,vout,vin,status
      1000,12.3,55,2300,1.85,2.78,CLEAR

    Supported labelled output:
      Volume=12.3 mL Pulses=55 Turbidity raw=2300 Vout=1.85V Vin=2.78V CLEAR
    """
    line = line.strip()

    if not line:
        return None

    if line.lower().startswith("time_ms"):
        return None

    # CSV line
    if "," in line:
        parts = [p.strip() for p in line.split(",")]

        if len(parts) >= 7:
            try:
                return {
                    "device_time_ms": int(float(parts[0])),
                    "volume_ml": float(parts[1]),
                    "pulses": int(float(parts[2])),
                    "turbidity_raw": int(float(parts[3])),
                    "vout": float(parts[4]),
                    "vin": float(parts[5]),
                    "status": parts[6],
                    "raw_line": line,
                }
            except ValueError:
                return None

    # Labelled line
    labelled_pattern = re.compile(
        r"Volume\s*=\s*(?P<volume>[0-9.]+)\s*mL.*?"
        r"(?:Pulses\s*=\s*(?P<pulses>[0-9]+).*?)?"
        r"Turbidity\s*raw\s*=\s*(?P<raw>[0-9]+).*?"
        r"Vout\s*=\s*(?P<vout>[0-9.]+)V.*?"
        r"Vin\s*=\s*(?P<vin>[0-9.]+)V.*?"
        r"(?P<status>CLEAR|CLOUDY|DARK|ERROR)",
        re.IGNORECASE,
    )

    match = labelled_pattern.search(line)

    if match:
        return {
            "device_time_ms": None,
            "volume_ml": float(match.group("volume")),
            "pulses": int(match.group("pulses")) if match.group("pulses") else None,
            "turbidity_raw": int(match.group("raw")),
            "vout": float(match.group("vout")),
            "vin": float(match.group("vin")),
            "status": match.group("status").upper(),
            "raw_line": line,
        }

    return None


def serial_reader(port, baud):
    reader_status.update(
        {
            "running": True,
            "port": port,
            "baud": baud,
            "last_error": "",
            "started_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
    )

    try:
        with serial.Serial(port, baud, timeout=1) as ser:
            time.sleep(2)

            while not stop_event.is_set():
                try:
                    line = ser.readline().decode(errors="ignore").strip()

                    if not line:
                        continue

                    reader_status["last_line"] = line

                    parsed = parse_sensor_line(line)

                    if parsed:
                        insert_reading(parsed)

                except Exception as exc:
                    reader_status["last_error"] = str(exc)
                    time.sleep(1)

    except Exception as exc:
        reader_status["last_error"] = str(exc)

    finally:
        reader_status["running"] = False


@app.route("/")
def index():
    return render_template("index.html", status=reader_status)


@app.route("/start", methods=["POST"])
def start_logging():
    global reader_thread

    if reader_status["running"]:
        return redirect(url_for("index"))

    port = request.form.get("port", "COM3").strip()
    baud = int(request.form.get("baud", "115200"))

    stop_event.clear()

    reader_thread = threading.Thread(
        target=serial_reader,
        args=(port, baud),
        daemon=True
    )

    reader_thread.start()

    return redirect(url_for("index"))


@app.route("/stop", methods=["POST"])
def stop_logging():
    stop_event.set()
    return redirect(url_for("index"))


@app.route("/api/readings")
def api_readings():
    limit = int(request.args.get("limit", 100))

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute(
            """
            SELECT * FROM readings
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return jsonify([dict(row) for row in rows])


@app.route("/api/status")
def api_status():
    return jsonify(reader_status)


@app.route("/clear", methods=["POST"])
def clear_readings():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM readings")
        conn.commit()

    return redirect(url_for("index"))


@app.route("/export")
def export_csv():
    with sqlite3.connect(DB_PATH) as conn, open(
        CSV_EXPORT_PATH,
        "w",
        newline="",
        encoding="utf-8"
    ) as f:
        writer = csv.writer(f)

        writer.writerow(
            [
                "id",
                "received_at",
                "device_time_ms",
                "volume_ml",
                "pulses",
                "turbidity_raw",
                "vout",
                "vin",
                "status",
                "raw_line",
            ]
        )

        for row in conn.execute("SELECT * FROM readings ORDER BY id ASC"):
            writer.writerow(row)

    return send_file(
        CSV_EXPORT_PATH,
        as_attachment=True,
        download_name="urine_readings.csv"
    )


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5000, debug=True)
