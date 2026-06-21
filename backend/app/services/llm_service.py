import json
from app.config import settings


def draft_communication_template(event_name: str, stage: str, recipient_type: str, custom_context: str = "") -> str:
    """
    Generates an automated email template based on the event stage and audience.
    """
    from groq import Groq  # lazy import

    client = Groq(api_key=settings.GROQ_API_KEY)

    prompt = f"""You are an automated event orchestrator writing an email template.
Event Name: {event_name}
Event Stage: {stage}
Audience: {recipient_type}
Additional Context: {custom_context}

Write a professional, encouraging email body.
You MUST strictly use these placeholders where appropriate:
{{name}} - The recipient's name
{{event_name}} - The name of the event
{{team_name}} - The name of the team (if applicable)
{{action_link}} - A link they need to click (if applicable)

Do not include the Subject line in the output, only the body. Keep it concise."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )
    return response.choices[0].message.content.strip()


def generate_teams_with_llm(
    participants: list,
    team_settings: dict,
    rules: list,
) -> list:
    """
    Calls Groq with JSON mode to distribute participants into balanced teams.

    Uses 1-based integer indices in the prompt/response (not UUIDs) so the LLM
    never has to reproduce UUID strings — indices map back to participants in code.

    Args:
        participants: list of dicts with keys id, name, institution, skills, experience
        team_settings: dict with min_team_size, max_team_size, max_per_institution
        rules: list of dicts with title, category, description

    Returns:
        list of dicts: [{name, rationale, member_ids: [str, ...]}, ...]
        member_ids are the real participant UUIDs, resolved from LLM-returned indices.
    """
    from groq import Groq  # lazy import

    client = Groq(api_key=settings.GROQ_API_KEY)

    # Build a compact participant table using 1-based indices (no UUIDs in prompt)
    participant_lines = []
    for i, p in enumerate(participants, start=1):
        skills_str = ", ".join(p["skills"]) if p["skills"] else "none"
        participant_lines.append(
            f"{i} | {p['name']} | {p['institution']} | {skills_str} | {p['experience']}"
        )
    participants_block = "\n".join(participant_lines)

    rules_block = (
        "\n".join(f"- [{r['category']}] {r['title']}: {r['description']}" for r in rules)
        if rules else "No additional rules specified."
    )

    prompt = f"""You are an intelligent team formation engine for a hackathon.

## Participants ({len(participants)} total)
Index | Name | Institution | Skills | Experience
{participants_block}

## Hard Constraints
- Each team must have between {team_settings['min_team_size']} and {team_settings['max_team_size']} members.
- At most {team_settings['max_per_institution']} members from the same institution per team.
- Every participant (indices 1 through {len(participants)}) must appear in exactly one team.
- No participant index may appear in more than one team.

## Custom Rules
{rules_block}

## Task
Form the optimal set of teams that satisfies all constraints, maximises skill diversity within each team, and balances experience levels.

## Required JSON Output
Return a JSON object with this exact schema. Use participant INDEX NUMBERS (not names) in member_indices:
{{
  "teams": [
    {{
      "name": "<creative team name>",
      "rationale": "<2-3 sentence explanation of why these members were grouped>",
      "member_indices": [<integer index>, ...]
    }}
  ]
}}

Every index from 1 to {len(participants)} must appear exactly once across all teams."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.4,
    )

    raw = response.choices[0].message.content
    data = json.loads(raw)

    if not isinstance(data, dict) or "teams" not in data:
        raise ValueError(f"Unexpected LLM response structure: {list(data.keys())}")

    llm_teams = data["teams"]
    if not isinstance(llm_teams, list) or len(llm_teams) == 0:
        raise ValueError("LLM returned an empty teams list.")

    # Convert 1-based indices → real participant UUIDs
    n = len(participants)
    result = []
    for td in llm_teams:
        member_ids = []
        for idx in td.get("member_indices", []):
            try:
                i = int(idx)
                if 1 <= i <= n:  # reject 0, negatives, and out-of-range
                    member_ids.append(participants[i - 1]["id"])
            except (ValueError, TypeError):
                pass
        result.append({
            "name": td.get("name", ""),
            "rationale": td.get("rationale", ""),
            "member_ids": member_ids,
        })

    return result