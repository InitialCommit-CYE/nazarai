"""Control the live ML service (Hugging Face Space) and model repo from your own machine.

Needs a fine-grained HF token scoped to the Space and model repo (read + write), in the env as HF_TOKEN,
e.g. `set -a; . ../HF_TOKEN.txt; set +a` (keep the token file OUTSIDE the repo).

  python scripts/space_ctl.py status                     # stage, hardware, live /health
  python scripts/space_ctl.py restart                    # restart (re-downloads the weights)
  python scripts/space_ctl.py set-var NAME VALUE         # public Space variable, e.g. APP_ENV
  python scripts/space_ctl.py set-secret NAME            # private Space secret; value read from the prompt
  python scripts/space_ctl.py upload-weights DIR         # push model.onnx, model.pt, model_config.json, then restart
"""
import getpass
import json
import os
import sys
import urllib.request

from huggingface_hub import HfApi

SPACE = os.environ.get("HF_SPACE", "HASSANALI0987654/nazarai-ml")
MODEL_REPO = os.environ.get("HF_MODEL_REPO", "HASSANALI0987654/nazarai-dr-model")
SPACE_URL = "https://" + SPACE.lower().replace("/", "-").replace("_", "-") + ".hf.space"
WEIGHTS = ("model.onnx", "model.pt", "model_config.json")


def main() -> None:
    token = os.environ.get("HF_TOKEN")
    if not token:
        sys.exit("HF_TOKEN is not set")
    api = HfApi(token=token)
    cmd, args = (sys.argv[1] if len(sys.argv) > 1 else "status"), sys.argv[2:]

    if cmd == "status":
        r = api.get_space_runtime(SPACE)
        print(f"{SPACE}: {r.stage} on {r.hardware}")
        try:
            print(json.dumps(json.load(urllib.request.urlopen(f"{SPACE_URL}/health", timeout=60)), indent=2))
        except Exception as e:  # sleeping or building
            print(f"/health not reachable yet: {e}")
    elif cmd == "restart":
        api.restart_space(SPACE)
        print("restart requested; check `status` in a few minutes")
    elif cmd == "set-var" and len(args) == 2:
        api.add_space_variable(SPACE, args[0], args[1])
        print(f"variable {args[0]} set (the Space restarts)")
    elif cmd == "set-secret" and len(args) == 1:
        api.add_space_secret(SPACE, args[0], getpass.getpass(f"{args[0]}: "))
        print(f"secret {args[0]} set (the Space restarts)")
    elif cmd == "upload-weights" and len(args) == 1:
        missing = [f for f in WEIGHTS if not os.path.isfile(os.path.join(args[0], f))]
        if missing:
            sys.exit(f"missing in {args[0]}: {missing}")
        for f in WEIGHTS:
            api.upload_file(path_or_fileobj=os.path.join(args[0], f), path_in_repo=f, repo_id=MODEL_REPO,
                            commit_message=f"Update {f}")
            print(f"uploaded {f}")
        api.restart_space(SPACE)
        print("weights uploaded and Space restarting; also commit the run's metrics.json + plots to ml/reports/")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
