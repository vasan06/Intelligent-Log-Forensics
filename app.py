from aegis_core import initialize_sentinel_platform

app = initialize_sentinel_platform()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
