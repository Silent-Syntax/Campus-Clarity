/* global window */

/**
 * CollegeAdvisor: client-side "agent" that joins a local college DB (profiles)
 * with TS EAMCET Phase-1 closing ranks and returns a ranked Top N list.
 *
 * Data sources are stored locally under `data/` so the app stays static.
 */

const CollegeAdvisor = (() => {
  const DB_PATHS = {
    profiles: "data/college-profiles.json",
    closingRanks: "data/closing-ranks-2025-phase1.json",
  };

  let cachePromise = null;

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function parseMoney(value) {
    // Accepts strings like "₹60,000", "?60,000", "60000"
    const digits = String(value || "").replace(/[^\d]/g, "");
    if (!digits) return null;
    const n = Number.parseInt(digits, 10);
    return Number.isFinite(n) ? n : null;
  }

  function parseRank(value) {
    const n = Number.parseInt(String(value || "").trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function rankFromBand(band) {
    switch (band) {
      case "under-1000":
        return 1000;
      case "1000-5000":
        return 5000;
      case "5000-10000":
        return 10000;
      case "10000-25000":
        return 25000;
      case "25000-50000":
        return 50000;
      case "50000-100000":
        return 100000;
      case "100000-plus":
        return 200000;
      default:
        return null;
    }
  }

  function normalizeCategory(category) {
    const c = String(category || "").trim().toUpperCase();
    if (!c) return "";
    if (c === "OBC") return "BC-B";
    if (c === "GENERAL") return "OC";
    return c;
  }

  function gradeScore(gradeRaw) {
    // Higher is better.
    const g = normalizeText(gradeRaw).toUpperCase();
    // Common NAAC grades we see in the data: A++, A+, A, B++, B+
    const map = {
      "A++": 5,
      "A+": 4,
      A: 3,
      "B++": 2,
      "B+": 1,
      B: 0,
    };
    return map[g] ?? null;
  }

  function minRequiredGradeScore(minGrade) {
    const g = String(minGrade || "").trim().toUpperCase();
    if (!g) return null;
    if (g === "B++") return 2;
    return gradeScore(g);
  }

  function matchesCollegeType(profile, selectedTypes) {
    if (!selectedTypes || selectedTypes.length === 0) return true;
    if (selectedTypes.includes("any")) return true;

    const isGov = normalizeText(profile.type).includes("government");
    const isPrivate = normalizeText(profile.type).includes("private");
    const isAutonomous =
      normalizeText(profile.autonomousStatus).includes("autonomous") ||
      normalizeText(profile.name).includes("autonomous");

    return selectedTypes.some((t) => {
      if (t === "government") return isGov;
      if (t === "private-autonomous") return isPrivate && isAutonomous;
      if (t === "private-jntuh-ou") return isPrivate && !isAutonomous;
      return true;
    });
  }

  function branchMatches(branchName, requiredBranch) {
    const req = normalizeText(requiredBranch);
    if (!req) return true;

    const b = normalizeText(branchName);
    if (!b) return false;

    const reqNormalized = req.replace(/[^a-z0-9+ ]/g, " ").trim();
    const bCompact = b.replace(/\s+/g, "");

    // Direct substring match (works for "mechanical", "computer science", etc.)
    if (b.includes(reqNormalized)) return true;

    // If user typed a short code, map it to patterns
    const reqCompact = reqNormalized.replace(/\s+/g, "");
    switch (reqCompact) {
      case "cse":
        return b.includes("computer") && b.includes("science");
      case "cs":
        return b.includes("computer") && (b.includes("science") || b.includes("engineering"));
      case "it":
        return b.includes("information technology") || (b.includes("information") && b.includes("technology"));
      case "ece":
        return b.includes("electronics") && b.includes("communication");
      case "eee":
        return b.includes("electrical") && b.includes("electronics");
      case "mech":
      case "mechanical":
        return b.includes("mechanical");
      case "civil":
        return b.includes("civil");
      case "aiml":
        return (
          (b.includes("artificial") && b.includes("intelligence")) ||
          b.includes("machine learning") ||
          bCompact.includes("aiml")
        );
      case "ds":
        return b.includes("data") && b.includes("science");
      default:
        return false;
    }
  }

  function getClosingRankForCategory(row, category) {
    const c = normalizeCategory(category);
    if (!c) return null;

    const getNum = (key) => {
      const v = row[key];
      const n = parseRank(v);
      return n;
    };

    if (c === "OC") {
      return Math.max(getNum("OC Boys") ?? 0, getNum("OC Girls") ?? 0) || null;
    }

    if (c === "SC") {
      return Math.max(getNum("SC Boys") ?? 0, getNum("SC Girls") ?? 0) || null;
    }

    if (c === "ST") {
      return Math.max(getNum("ST Boys") ?? 0, getNum("ST Girls") ?? 0) || null;
    }

    if (c === "EWS") {
      return Math.max(getNum("EWS GEN OU") ?? 0, getNum("EWS GIRLS") ?? 0) || null;
    }

    if (c.startsWith("BC-")) {
      const boysKey = `${c} Boys`;
      const girlsKey = `${c} Girls`;
      return Math.max(getNum(boysKey) ?? 0, getNum(girlsKey) ?? 0) || null;
    }

    return null;
  }

  function safeWebsite(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    return `https://${raw}`;
  }

  async function loadDatabase() {
    if (cachePromise) return cachePromise;

    cachePromise = (async () => {
      const [profilesRes, closingRes] = await Promise.all([
        fetch(DB_PATHS.profiles),
        fetch(DB_PATHS.closingRanks),
      ]);

      if (!profilesRes.ok || !closingRes.ok) {
        throw new Error(
          "Failed to load the college database. Run this project via a local server (not file://)."
        );
      }

      const [profiles, closingRanks] = await Promise.all([
        profilesRes.json(),
        closingRes.json(),
      ]);

      const profilesByCode = new Map();
      profiles.forEach((p) => {
        if (p && p.collegeCode) profilesByCode.set(String(p.collegeCode).trim(), p);
      });

      const closingByCollege = new Map();
      closingRanks.forEach((row) => {
        const code = String(row["College Code"] || "").trim();
        if (!code) return;
        if (!closingByCollege.has(code)) closingByCollege.set(code, []);
        closingByCollege.get(code).push(row);
      });

      // Only keep colleges that appear in both datasets (avoids empty results).
      const collegeCodes = Array.from(profilesByCode.keys()).filter((code) =>
        closingByCollege.has(code)
      );

      return {
        profilesByCode,
        closingByCollege,
        collegeCodes,
        counts: {
          profileColleges: profilesByCode.size,
          closingRankColleges: closingByCollege.size,
          joinedColleges: collegeCodes.length,
          closingRows: closingRanks.length,
        },
      };
    })();

    return cachePromise;
  }

  function suggestColleges(studentPrefs, db, options = {}) {
    const topN = options.topN ?? 10;
    const results = [];

    const category = normalizeCategory(studentPrefs.category);
    const requiredBranch = String(studentPrefs.requiredBranch || "");
    const collegeTypes = Array.isArray(studentPrefs.collegeType)
      ? studentPrefs.collegeType
      : studentPrefs.collegeType
        ? [studentPrefs.collegeType]
        : [];

    const exactRank = parseRank(studentPrefs.examRank);
    const bandRank = rankFromBand(studentPrefs.examRankBand);
    const studentRank = exactRank ?? bandRank; // use band upper bound as a conservative estimate

    const budgetMin = parseMoney(studentPrefs.budgetMin);
    const budgetMax = parseMoney(studentPrefs.budgetMax);

    const homeLocation = normalizeText(studentPrefs.homeLocation);
    const dreamColleges = normalizeText(studentPrefs.dreamColleges);

    const minGrade = minRequiredGradeScore(studentPrefs.naacGrade);

    db.collegeCodes.forEach((collegeCode) => {
      const profile = db.profilesByCode.get(collegeCode);
      const closingRows = db.closingByCollege.get(collegeCode) || [];
      if (!profile || closingRows.length === 0) return;

      if (!matchesCollegeType(profile, collegeTypes)) return;

      const fee = parseMoney(profile.fees);
      if (budgetMax != null && fee != null && fee > Math.round(budgetMax * 1.05)) return;

      const naac = profile.naacGrade || "";
      if (minGrade != null) {
        const collegeGrade = gradeScore(naac);
        if (collegeGrade == null || collegeGrade < minGrade) return;
      }

      // Pick best-matching branch row for this student.
      const matchingRows = requiredBranch
        ? closingRows.filter((r) => branchMatches(r["Branch Name"], requiredBranch))
        : closingRows.slice();

      if (matchingRows.length === 0) return;

      // If student rank is known, keep only rows where eligible.
      const eligibleRows =
        studentRank != null && category
          ? matchingRows.filter((r) => {
              const cutoff = getClosingRankForCategory(r, category);
              return cutoff != null && studentRank <= cutoff;
            })
          : matchingRows;

      if (studentRank != null && category && eligibleRows.length === 0) return;

      // Choose the "best" row: smallest positive gap between cutoff and studentRank,
      // otherwise just pick the most competitive (lowest OC cutoff) as a proxy.
      let chosen = null;
      let bestKey = Number.POSITIVE_INFINITY;

      eligibleRows.forEach((r) => {
        if (studentRank != null && category) {
          const cutoff = getClosingRankForCategory(r, category);
          if (cutoff == null) return;
          const gap = cutoff - studentRank; // >=0
          if (gap < bestKey) {
            bestKey = gap;
            chosen = r;
          }
          return;
        }

        // Fallback: lower OC cutoff ~ more competitive
        const oc = getClosingRankForCategory(r, "OC");
        if (oc != null && oc < bestKey) {
          bestKey = oc;
          chosen = r;
        }
      });

      if (!chosen) return;

      const branchName = chosen["Branch Name"] || "";
      const cutoff = category ? getClosingRankForCategory(chosen, category) : null;

      // Scoring
      let score = 0;
      const reasons = [];

      // Eligibility / closeness
      if (studentRank != null && category && cutoff != null) {
        const gap = cutoff - studentRank;
        const closeness = Math.max(0, 1 - gap / Math.max(cutoff, 1)); // 0..1
        score += 55 + closeness * 25;
        reasons.push(`Eligible: your rank ${studentRank} ≤ cutoff ${cutoff} (${category})`);
      } else if (studentRank == null) {
        score += 25;
        reasons.push("Rank not provided: showing likely options (eligibility not guaranteed)");
      } else if (!category) {
        score += 20;
        reasons.push("Category not provided: eligibility depends on category cutoffs");
      }

      // Budget
      if (fee != null) {
        if (budgetMax != null) {
          if (fee <= budgetMax) {
            score += 12;
            reasons.push(`Fees fit: ~₹${fee.toLocaleString("en-IN")}/yr`);
          }
        } else {
          score += 6;
          reasons.push(`Fees: ~₹${fee.toLocaleString("en-IN")}/yr`);
        }
        if (budgetMin != null && fee < budgetMin) score -= 2;
      }

      // NAAC
      const gScore = gradeScore(naac);
      if (gScore != null) score += gScore * 2;
      if (naac) reasons.push(`NAAC: ${naac}`);

      // NIRF (if present)
      const nirf = parseRank(profile.nirfRank);
      if (nirf != null) {
        // Simple normalization: better rank => higher points
        score += Math.max(0, 12 - Math.min(12, Math.floor(nirf / 50)));
        reasons.push(`NIRF: ${nirf}`);
      }

      // Location match
      const loc = normalizeText(profile.location);
      const dist = normalizeText(profile.district);
      if (homeLocation) {
        const hit = loc.includes(homeLocation) || dist.includes(homeLocation) || homeLocation.includes(loc);
        if (hit) {
          score += 10;
          reasons.push(`Near your location: ${profile.location}, ${profile.district}`);
        }
      }

      // Dream college boost
      if (dreamColleges) {
        const name = normalizeText(profile.name);
        if (name.includes(dreamColleges) || dreamColleges.includes(name)) {
          score += 18;
          reasons.push("Matches your dream college list");
        }
      }

      // College type boost (soft)
      const isGov = normalizeText(profile.type).includes("government");
      const isAutonomous =
        normalizeText(profile.autonomousStatus).includes("autonomous") ||
        normalizeText(profile.name).includes("autonomous");
      if (isGov) score += 4;
      if (isAutonomous) score += 3;

      results.push({
        collegeCode,
        collegeName: profile.name || chosen["College Name"] || collegeCode,
        branchName,
        district: profile.district || "",
        location: profile.location || "",
        type: profile.type || "",
        fees: fee,
        naacGrade: naac,
        nirfRank: nirf,
        website: safeWebsite(profile.website),
        cutoff,
        category: category || "",
        score,
        reasons,
      });
    });

    results.sort((a, b) => b.score - a.score);

    // De-duplicate colleges (keep best branch per college)
    const seen = new Set();
    const top = [];
    for (const r of results) {
      if (seen.has(r.collegeCode)) continue;
      seen.add(r.collegeCode);
      top.push(r);
      if (top.length >= topN) break;
    }

    return {
      top,
      meta: {
        consideredColleges: db.collegeCodes.length,
        studentRank,
        category,
        requiredBranch: requiredBranch.trim(),
        budgetMin,
        budgetMax,
      },
    };
  }

  function formatSuggestionHTML(s, idx) {
    const feeText =
      s.fees != null ? `₹${s.fees.toLocaleString("en-IN")}/yr` : "Not available";
    const cutoffText =
      s.cutoff != null && s.category ? `${s.cutoff} (${s.category})` : "Not available";
    const website = s.website ? `<a href="${s.website}" target="_blank" rel="noreferrer">Website</a>` : "";

    const reasons = (s.reasons || [])
      .slice(0, 4)
      .map((r) => `<li>${r}</li>`)
      .join("");

    return `
      <article class="result-card">
        <div class="result-card__header">
          <div>
            <div class="result-rank">#${idx + 1}</div>
            <h3 class="result-title">${s.collegeName}</h3>
            <div class="result-subtitle">
              <span class="result-chip">${s.collegeCode}</span>
              <span class="result-chip">${s.branchName}</span>
            </div>
          </div>
          <div class="result-meta">
            <div><span class="result-meta__label">Fees</span> ${feeText}</div>
            <div><span class="result-meta__label">Cutoff</span> ${cutoffText}</div>
            <div><span class="result-meta__label">Location</span> ${s.location}${s.district ? `, ${s.district}` : ""}</div>
            <div><span class="result-meta__label">Type</span> ${s.type || "—"}</div>
            ${website ? `<div class="result-links">${website}</div>` : ""}
          </div>
        </div>

        <details class="result-details">
          <summary>Why this matched</summary>
          <ul class="result-reasons">${reasons}</ul>
        </details>
      </article>
    `;
  }

  function renderResults(container, suggestions) {
    const top = suggestions.top || [];
    const meta = suggestions.meta || {};

    if (top.length === 0) {
      container.innerHTML = `
        <div class="results-empty">
          <h3>No colleges matched your filters.</h3>
          <p>Try one of these:</p>
          <ul>
            <li>Remove branch filter (leave it empty)</li>
            <li>Increase budget max</li>
            <li>Remove NAAC minimum</li>
            <li>Check your rank/category inputs</li>
          </ul>
        </div>
      `;
      return;
    }

    const headerBits = [];
    headerBits.push(`<span class="results-pill">Considered: ${meta.consideredColleges ?? "—"} colleges</span>`);
    if (meta.studentRank != null) headerBits.push(`<span class="results-pill">Rank used: ${meta.studentRank}</span>`);
    if (meta.category) headerBits.push(`<span class="results-pill">Category: ${meta.category}</span>`);
    if (meta.requiredBranch) headerBits.push(`<span class="results-pill">Branch: ${meta.requiredBranch}</span>`);
    if (meta.budgetMax != null) headerBits.push(`<span class="results-pill">Budget max: ₹${meta.budgetMax.toLocaleString("en-IN")}</span>`);

    container.innerHTML = `
      <div class="results-header">
        <h2 class="results-title">Top college suggestions (Top ${top.length})</h2>
        <div class="results-pills">${headerBits.join("")}</div>
      </div>
      <div class="results-list">
        ${top.map((s, idx) => formatSuggestionHTML(s, idx)).join("")}
      </div>
    `;
  }

  return {
    loadDatabase,
    suggestColleges,
    renderResults,
    DB_PATHS,
  };
})();

window.CollegeAdvisor = CollegeAdvisor;

