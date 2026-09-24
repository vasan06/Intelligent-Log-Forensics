from aegis_core import initialize_sentinel_platform


app = initialize_sentinel_platform()


if __name__ == "__main__":
    app.run(debug=True)