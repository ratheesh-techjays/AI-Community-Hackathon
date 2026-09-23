"""The grounding validator: every number Gemini writes must be a number the
engine computed and put in the prompt (PRD rule 2, 04-ai-layer.md §4).

Checks, all hard:
- numeric: every number in the text, scaled by any lakh/crore/thousand word
  after it, is one of the facts: integers exactly, decimals rounded to 1-2
  places. Numbers glued to letters count too ("INR5000000").
- context: only what the caller names is exempt: the storm label, real ids,
  and the real dates and clock times of this run (landfall, stage deadlines).
  Stage hours are exempt only inside a time phrase ("T-48h", "24 ଘଣ୍ଟା").
- claims: casualty words, claims that something was issued or done, and
  certainty words are rejected, in English and Odia.
- money: a rupee figure must carry the word "illustrative": the payouts are a
  mechanism demo, never an actuarial amount.

Known limit, stated rather than hidden: numbers written as words ("half a
million") are not parsed. The prompt forbids them, and evals measure the rest.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

from prahari.models.results import GroundingReport

STAGE_HOURS = (72, 48, 24, 12)

_MONTH = (
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|"
    r"sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
)
_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
_DAY_MONTH = re.compile(
    rf"\b(?P<d1>0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+(?P<m1>{_MONTH})\b(?:\s+(?P<y1>(?:19|20)\d\d)\b)?"
    rf"|\b(?P<m2>{_MONTH})\s+(?P<d2>0?[1-9]|[12]\d|3[01])\b(?:,?\s+(?P<y2>(?:19|20)\d\d)\b)?",
    re.IGNORECASE,
)
_ISO_DATE = re.compile(
    r"\b(?:19|20)\d\d-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:T[\d:+.Z-]+)?\b"
)
_CLOCK = re.compile(
    r"\b(?P<hh>[01]?\d|2[0-3]):(?P<mm>[0-5]\d)\b(?:\s*(?:IST|UTC|hrs?))?", re.IGNORECASE
)
_HOURS = "|".join(str(h) for h in STAGE_HOURS)
_STAGE_TIME = re.compile(
    rf"\bT\s?-\s?(?:{_HOURS})\s?h\b|\b(?:{_HOURS})(?:\.0)?\s?-?\s?(?:hours?|hrs?|h|ଘଣ୍ଟା|घंटे|घंटा)"
    rf"(?=\s+(?:before|to|ahead|prior|of)\b|[\s.,;)]|$)",
    re.IGNORECASE,
)
_UNITS = re.compile(r"\b(km|m)(?:2|²)\b")
# No word boundary after the digits: "5000people", "6m" and "300km" are numbers.
_NUMBER = re.compile(
    r"(?<![\d.])(\d[\d,]*(?:\.\d+)?)"
    r"(?:\s*-?\s*(lakhs?|lacs?|crores?|cr|thousand|million|mn|billion|bn|hundred|k|m(?=\s+(?:people|persons|residents|households|houses|buildings|population))|"
    r"ଲକ୍ଷ|କୋଟି|ହଜାର|लाख|करोड़|हज़ार|हजार)(?![a-z]))?",
    re.IGNORECASE,
)
_SCALE = {
    "lakh": 1e5,
    "lakhs": 1e5,
    "lac": 1e5,
    "lacs": 1e5,
    "cr": 1e7,
    "mn": 1e6,
    "bn": 1e9,
    "m": 1e6,
    "crore": 1e7,
    "crores": 1e7,
    "thousand": 1e3,
    "million": 1e6,
    "billion": 1e9,
    "hundred": 1e2,
    "k": 1e3,
    "ଲକ୍ଷ": 1e5,
    "କୋଟି": 1e7,
    "ହଜାର": 1e3,
    "लाख": 1e5,
    "करोड़": 1e7,
    "हज़ार": 1e3,
    "हजार": 1e3,
}
_DIGITS = str.maketrans(
    "୦୧୨୩୪୫୬୭୮୯०१२३४५६७८९০১২৩৪৫৬৭৮৯０１２３４５６７８９",
    "0123456789" * 4,
)

# Claims the narrator must never make. The system computes; it does not act,
# does not model casualties (PRD rule 1), and is never certain.
BANNED_CLAIMS = re.compile(
    r"\b(?:casualt\w*|deaths?|died|dead|die|dying|kill\w*|fatalit\w*|injur\w*|drown\w*|"
    r"perish\w*|succumb\w*|swept away|loss of li(?:fe|ves)|"
    r"los(?:e|ing) (?:their |his |her )?lives?|"
    r"(?:possibly |even )?their lives|(?:may|might|will|could) not survive|mortality|"
    r"lives (?:will|may|could|would) be lost|"
    r"lives (?:were|have been|had been) lost|lost (?:their |his |her )?lives?|fatal\w*|"
    r"(?:was|were|has\s+been|have\s+been|had\s+been|is\s+being|are\s+being|got)\s+"
    r"(?:issued|sent|communicated|dispatched|deployed|evacuated|completed|relocated|informed|"
    r"positioned|pre-positioned|ordered|mobilised|mobilized|activated|opened|closed)|"
    r"(?:has|have|had) "
    r"(?:issued|sent|dispatched|communicated|deployed|evacuated|completed|ordered)|"
    r"(?:is|are|was|were) (?:now )?(?:fully )?"
    r"(?:complete|completed|done|finished|underway|concluded)|"
    r"(?:has|have|had) (?:now |already )?(?:concluded|gone out|evacuated|moved|left)|"
    r"(?:is|are|was|were) (?:now )?over(?=\s*[.,;!]|\s*$)|"
    r"(?:have|has) been moved|moved to safety|went out|gone out|are in place|is in place|"
    r"already (?:evacuated|moved|issued|sent)|evacuated safely|safely evacuated|"
    r"communicated to|guarantee\w*|certain(?:ly|ty)?|surely|definitely|without doubt|"
    r"absolutely|undoubtedly|for sure|resulting in|results in|because of)\b"
    r"|ମୃତ୍ୟୁ|ମୃତ|ମରିବେ|ଆହତ|ପ୍ରାଣହାନି|ଜାରି କରାଯାଇଛି|ପଠାଯାଇଛି|मृत्यु|मौत|मारे जा",
    re.IGNORECASE,
)
_MONEY = re.compile(
    r"(?:₹|₨|\$|£|€|\bUSD\b|\bINR|\bRs\.?|\brupees?\b|\bcrores?\b|ଟଙ୍କା|କୋଟି|रुपये|करोड़)",
    re.IGNORECASE,
)
_ILLUSTRATIVE = re.compile(r"(?<!not )(?<!non-)illustrative|ଦୃଷ୍ଟାନ୍ତ", re.IGNORECASE)
_NOT_ILLUSTRATIVE = re.compile(r"\b(?:not|non-?)\s*illustrative", re.IGNORECASE)
# "10-15 m", "10 to 15 m": a range is a new claim even when both ends are facts.
_RANGE = re.compile(
    r"(?<![\d.])(\d[\d,.]*)\s*(?:-|\u2013|\u2014|to|and)\s*(\d[\d,.]*)(?![\d-])", re.IGNORECASE
)


class GroundingSet(BaseModel):
    """Every numeric fact the narrator was given, plus exempt context phrases."""

    facts: dict[str, float]
    context: list[str] = Field(default_factory=list)  # e.g. "Fani 2019", real register ids
    # Real dates ("YYYY-MM-DD") and clock times ("HH:MM") the text may name. Any
    # other date or time is not exempt: its digits must be facts.
    dates: list[str] = Field(default_factory=list)
    times: list[str] = Field(default_factory=list)

    def contains(self, n: float) -> bool:
        return any(_matches(v, n) for v in self.facts.values())


def _matches(value: float, written: float) -> bool:
    if value == written:
        return True
    if float(value).is_integer():
        return False  # counts are quoted exactly or not at all
    return any(round(value, d) == written for d in (1, 2))


_ONES = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
}
_TENS = {
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}
_WORD_SCALE = {"hundred": 1e2, "thousand": 1e3, "lakh": 1e5, "million": 1e6, "crore": 1e7}
_FRACTION = {"half a": 0.5, "a quarter of a": 0.25, "a third of a": 1 / 3}
_NUMBER_WORD = re.compile(
    r"\b(?:(?P<frac>half a|a quarter of a|a third of a)\s+(?P<fscale>million|lakh|crore)"
    r"|(?P<tens>" + "|".join(_TENS) + r")(?:[\s-](?P<unit>" + "|".join(list(_ONES)[:9]) + r"))?"
    r"(?:\s+(?P<tscale>hundred|thousand|lakh|million|crore))?"
    r"|(?P<ones>" + "|".join(_ONES) + r")\s*(?P<oscale>hundred|thousand|lakh|million|crore)?)\b",
    re.IGNORECASE,
)
# "one of the", "no one", "a one-off": function words, not counts.
_NOT_A_COUNT = re.compile(
    r"\bone (?:of|another|by one)\b|\bno one\b|\bone-(?:off|time)\b", re.IGNORECASE
)


def word_numbers(text: str) -> list[tuple[str, float]]:
    """Counts written as words: 'thirty shelters' -> 30, 'half a million' -> 500000."""
    out = []
    for m in _NUMBER_WORD.finditer(_NOT_A_COUNT.sub(" ", text)):
        if m.group("frac"):
            value = _FRACTION[m.group("frac").lower()] * _WORD_SCALE[m.group("fscale").lower()]
        elif m.group("tens"):
            value = _TENS[m.group("tens").lower()] + _ONES.get((m.group("unit") or "").lower(), 0)
            if m.group("tscale"):
                value *= _WORD_SCALE[m.group("tscale").lower()]
        else:
            value = _ONES[m.group("ones").lower()]
            if m.group("oscale"):
                value *= _WORD_SCALE[m.group("oscale").lower()]
        out.append((m.group(0), float(value)))
    return out


def scaled_numbers(text: str) -> list[tuple[str, float]]:
    """Every number in `text` with its scale word applied: '2.6 lakh' -> 260000."""
    out = []
    for m in _NUMBER.finditer(text.translate(_DIGITS)):
        raw = m.group(1).rstrip(",")
        try:
            value = float(raw.replace(",", ""))
        except ValueError:
            continue
        scale = m.group(2)
        out.append((m.group(0).strip(), value * _SCALE[scale.lower()] if scale else value))
    return out


def _known_date(match: re.Match[str], dates: set[tuple[int, int]], iso: set[str]) -> str:
    day = match.group("d1") or match.group("d2")
    month = (match.group("m1") or match.group("m2") or "")[:3].lower()
    if (int(day), _MONTHS.index(month) + 1) in dates and _year_ok(match, iso):
        return " "
    return match.group(0)


def normalise(text: str, allowed: GroundingSet) -> str:
    text = text.translate(_DIGITS)
    for year in {c[-4:] for c in allowed.context if c[-4:].isdigit()}:
        text = re.sub(rf"\(\s*{year}\s*\)|\b{year}\s+(?:cyclone\s+)?season\b", " ", text)
    for phrase in sorted(allowed.context, key=len, reverse=True):
        if phrase:
            text = re.sub(re.escape(phrase), " ", text, flags=re.IGNORECASE)
    iso = set(allowed.dates)
    text = _ISO_DATE.sub(lambda m: " " if m.group(0)[:10] in iso else m.group(0), text)
    day_months = {(int(d[8:10]), int(d[5:7])) for d in allowed.dates}
    text = _DAY_MONTH.sub(lambda m: _known_date(m, day_months, iso), text)
    times = {t.lstrip("0") or "0" for t in allowed.times} | set(allowed.times)
    text = _CLOCK.sub(
        lambda m: " " if f"{m.group('hh')}:{m.group('mm')}".lstrip("0") in times else m.group(0),
        text,
    )
    text = _STAGE_TIME.sub(" ", text)
    return _UNITS.sub(r"\1²", text)


def _year_ok(match: re.Match[str], dates: set[str]) -> bool:
    year = match.group("y1") or match.group("y2")
    return not year or any(d.startswith(year) for d in dates)


def validate(text: str, allowed: GroundingSet) -> GroundingReport:
    found: list[float] = []
    ungrounded: list[str] = []
    normalised = normalise(text, allowed)
    for raw, value in scaled_numbers(normalised) + word_numbers(normalised):
        found.append(value)
        if not allowed.contains(value):
            ungrounded.append(raw)
    banned = sorted({m.group(0).lower() for m in BANNED_CLAIMS.finditer(text)})
    if _MONEY.search(text) and (not _ILLUSTRATIVE.search(text) or _NOT_ILLUSTRATIVE.search(text)):
        banned.append("money figure without 'illustrative'")
    for m in _RANGE.finditer(normalise(text, allowed)):
        banned.append(f"range '{m.group(0).strip()}' (quote one computed value, not a range)")
    return GroundingReport(
        ok=not ungrounded and not banned, found=found, ungrounded=ungrounded, banned=banned
    )
