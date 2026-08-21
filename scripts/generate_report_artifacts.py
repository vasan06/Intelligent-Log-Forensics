import csv
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
from sklearn.metrics import ConfusionMatrixDisplay, auc, confusion_matrix, roc_curve

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
OUTPUT = ROOT / "docs/artifacts"

from evaluate_models import evaluate


def _save_flow(filename, title, nodes, edges, figsize=(12, 7)):
    figure, axis = plt.subplots(figsize=figsize)
    axis.set_xlim(0, 1)
    axis.set_ylim(0, 1)
    axis.axis("off")
    axis.set_title(title, fontsize=17, fontweight="bold", pad=18)
    for key, (x, y, label, color) in nodes.items():
        box = FancyBboxPatch((x - .075, y - .035), .15, .07, boxstyle="round,pad=.012,rounding_size=.012",
                             facecolor=color, edgecolor="#17324d", linewidth=1.2)
        axis.add_patch(box)
        axis.text(x, y, label, ha="center", va="center", fontsize=8.5, wrap=True)
    for source, target in edges:
        sx, sy = nodes[source][:2]
        tx, ty = nodes[target][:2]
        arrow = FancyArrowPatch((sx, sy), (tx, ty), arrowstyle="-|>", mutation_scale=12,
                                linewidth=1.1, color="#365b78", shrinkA=52, shrinkB=52)
        axis.add_patch(arrow)
    figure.tight_layout()
    figure.savefig(OUTPUT / filename, dpi=180, bbox_inches="tight")
    plt.close(figure)


def generate_diagrams():
    blue, green, gold, purple = "#dceeff", "#dff5e7", "#fff1cc", "#ece4ff"
    system_nodes = {
        "analyst": (.08,.78,"Analyst browser",blue), "routes": (.27,.78,"Flask routes / REST",blue),
        "ingest": (.46,.78,"Upload or live generator",gold), "pipeline": (.65,.78,"Shared processing pipeline",green),
        "detect": (.84,.78,"Rules + PyOD ensemble",purple), "taxonomy": (.84,.52,"Taxonomy / MITRE",purple),
        "repo": (.65,.52,"psycopg2 repositories",green), "db": (.46,.52,"PostgreSQL",blue),
        "api": (.27,.52,"JSON API + SSE",blue), "feedback": (.65,.25,"Feedback / retraining",gold),
        "model": (.84,.25,"Versioned model store",purple)
    }
    _save_flow("system_flow.png", "System Flow Diagram", system_nodes,
               [("analyst","routes"),("routes","ingest"),("ingest","pipeline"),("pipeline","detect"),
                ("detect","taxonomy"),("taxonomy","repo"),("repo","db"),("db","api"),("api","analyst"),
                ("db","feedback"),("feedback","model"),("model","detect")])

    dfd0 = {"analyst":(.14,.55,"External entity:\nAnalyst",blue), "system":(.5,.55,"Intelligent Log\nForensics System",green),
            "db":(.86,.72,"PostgreSQL",gold), "models":(.86,.36,"Model store",purple)}
    _save_flow("dfd_level_0.png", "DFD Level 0 — Context", dfd0,
               [("analyst","system"),("system","analyst"),("system","db"),("db","system"),("system","models"),("models","system")], (10,5))

    dfd1 = {"analyst":(.08,.78,"Analyst",blue), "auth":(.27,.78,"1. Authenticate",green),
            "ingest":(.46,.78,"2. Ingest evidence",green), "detect":(.65,.78,"3. Detect / explain",green),
            "correlate":(.84,.78,"4. Correlate / map",green), "review":(.65,.42,"5. Review / retrain",purple),
            "query":(.27,.42,"6. Dashboard / reports",purple), "db":(.46,.18,"Structured stores",gold)}
    _save_flow("dfd_level_1.png", "DFD Level 1 — Major Processes", dfd1,
               [("analyst","auth"),("analyst","ingest"),("ingest","detect"),("detect","correlate"),
                ("correlate","db"),("db","review"),("review","db"),("db","query"),("query","analyst")])

    dfd2 = {"input":(.07,.72,"Bytes / generated rows",blue), "hash":(.22,.72,"2.1 Hash / source tag",gold),
            "parse":(.37,.72,"2.2 Parse / normalize",green), "feature":(.52,.72,"2.3 Shared features",green),
            "rules":(.67,.84,"2.4 Rules",purple), "ml":(.67,.60,"2.5 ML ensemble",purple),
            "explain":(.82,.72,"2.6 Explain / MITRE",gold), "correlate":(.82,.40,"2.7 Correlate",green),
            "tx":(.60,.30,"2.8 Atomic SQL transaction",green), "db":(.37,.30,"PostgreSQL",blue),
            "sse":(.15,.30,"2.9 Post-commit SSE",purple)}
    _save_flow("dfd_level_2.png", "DFD Level 2 — Evidence Processing", dfd2,
               [("input","hash"),("hash","parse"),("parse","feature"),("feature","rules"),("feature","ml"),
                ("rules","explain"),("ml","explain"),("explain","correlate"),("correlate","tx"),
                ("tx","db"),("tx","sse")])

    er = {"users":(.10,.78,"users",blue), "uploads":(.30,.78,"uploaded_files",green),
          "logs":(.50,.78,"normalized_logs",green), "risks":(.70,.78,"risk_events",purple),
          "mitre":(.90,.78,"mitre_mappings",gold), "quality":(.30,.48,"data_quality_results",gold),
          "incidents":(.50,.48,"incidents",purple), "events":(.70,.48,"incident_events",purple),
          "reports":(.30,.18,"reports",blue), "runs":(.70,.18,"model_retraining_runs",gold)}
    _save_flow("er_diagram.png", "Entity–Relationship Overview", er,
               [("users","uploads"),("uploads","logs"),("logs","risks"),("risks","mitre"),
                ("uploads","quality"),("uploads","incidents"),("incidents","events"),
                ("uploads","reports"),("users","reports"),("users","risks")])


def generate_evaluation():
    result = evaluate(samples_per_mode=300, artifact_path=ROOT / "instance/models/anomaly_ensemble.joblib")
    with (OUTPUT / "model_metrics.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(result["rows"][0]))
        writer.writeheader()
        writer.writerows(result["rows"])

    matrix = confusion_matrix(result["y_true"], result["combined_predictions"], labels=[0, 1])
    figure, axis = plt.subplots(figsize=(6, 5))
    ConfusionMatrixDisplay(matrix, display_labels=["Normal", "Anomaly"]).plot(ax=axis, cmap="Blues", colorbar=False)
    axis.set_title("Combined PyOD Ensemble — Held-out Confusion Matrix")
    figure.tight_layout()
    figure.savefig(OUTPUT / "confusion_matrix.png", dpi=180)
    plt.close(figure)

    false_positive, true_positive, _ = roc_curve(result["y_true"], result["combined_scores"])
    roc_auc = auc(false_positive, true_positive)
    figure, axis = plt.subplots(figsize=(6, 5))
    axis.plot(false_positive, true_positive, color="#6d4aff", linewidth=2, label=f"Ensemble AUC = {roc_auc:.3f}")
    axis.plot([0, 1], [0, 1], "--", color="#607087", label="Random classifier")
    axis.set(xlabel="False Positive Rate", ylabel="True Positive Rate", title="Combined PyOD Ensemble — ROC Curve")
    axis.legend(loc="lower right")
    axis.grid(alpha=.2)
    figure.tight_layout()
    figure.savefig(OUTPUT / "roc_curve.png", dpi=180)
    plt.close(figure)
    (OUTPUT / "evaluation_summary.txt").write_text(
        f"dataset_rows=1200\nheld_out_rows={len(result['y_true'])}\ncombination={result['combination']}\nroc_auc={roc_auc:.6f}\n",
        encoding="utf-8",
    )
    return result, roc_auc


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    generate_diagrams()
    result, roc_auc = generate_evaluation()
    print(f"Generated {len(list(OUTPUT.iterdir()))} report artifacts in {OUTPUT}")
    print(f"combined_f1={next(row['f1'] for row in result['rows'] if row['model']=='combined'):.3f} roc_auc={roc_auc:.3f}")


if __name__ == "__main__":
    main()
