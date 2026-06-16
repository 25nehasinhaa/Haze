def build_interview_probes(result: dict) -> list[str]:
    probes = []
    for gap in result["gaps"][:2]:
        if gap["type"] == "critical gap":
            probes.append(f"Validate depth in {gap['skill']} with a production example.")
        else:
            probes.append(f"Ask how quickly they could ramp on {gap['skill']}.")

    for risk in result["risk_flags"]:
        if risk.startswith("Unsupported claims"):
            probes.append("Ask the candidate to walk through concrete project evidence for the unsupported claims.")
            break

    if result["snr"] < 0.5:
        probes.append("Probe whether the resume keywords reflect hands-on work or surface-level exposure.")

    return probes or ["Ask for a recent end-to-end project and the candidate's exact ownership."]

