
import fs from "node:fs";
import path from "node:path";

const username = "CodeByAbi";
const token = process.env.GITHUB_TOKEN;
const timezone = "Asia/Jakarta";

if (!token) {
  throw new Error("GITHUB_TOKEN is missing.");
}

function getLocalDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(dateString, offset) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[char]);
}

function makeCard(overline, title, items) {
  const PAD = 28;
  const INNER = 460 - PAD * 2;
  const HEADER_H = 92;
  const FOOTER_H = 34;

  let y = HEADER_H;
  const rows = items.map((item, index) => {
    const top = y;
    const rowH = item.bar ? 78 : 58;
    const labelY = top + 24;
    const valueY = top + 29;

    const dot = item.dot
      ? `<circle cx="${PAD + 4}" cy="${labelY - 4}" r="4" fill="${escapeXml(item.dot)}"/>`
      : "";
    const labelX = item.dot ? PAD + 16 : PAD;

    const bar = item.bar
      ? `<rect x="${PAD}" y="${top + 42}" width="${INNER}" height="6" rx="3" fill="#21262d"/>` +
        `<rect x="${PAD}" y="${top + 42}" width="${Math.max(4, (INNER * Math.min(100, Math.max(0, item.bar.pct))) / 100).toFixed(1)}" height="6" rx="3" fill="${escapeXml(item.bar.color)}"/>`
      : "";

    const divider = index > 0
      ? `<line x1="${PAD}" y1="${top}" x2="${460 - PAD}" y2="${top}" stroke="#1c2128" stroke-width="1"/>`
      : "";

    y += rowH;

    return `
      ${divider}
      ${dot}
      <text x="${labelX}" y="${labelY}" fill="#9aa4b2" font-size="13">${escapeXml(item.label)}</text>
      <text x="${460 - PAD}" y="${valueY}" text-anchor="end" fill="#ffffff" font-size="21" font-weight="800">${escapeXml(item.value)}</text>
      ${bar}
    `;
  }).join("");

  const height = y + FOOTER_H;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="460" height="${height}" viewBox="0 0 460 ${height}">
      <rect width="460" height="${height}" rx="16" fill="#0d1117" stroke="#30363d"/>
      <rect x="${PAD}" y="24" width="26" height="4" rx="2" fill="#58a6ff"/>
      <text x="${PAD}" y="48" fill="#58a6ff" font-size="10.5" font-weight="700" letter-spacing="2.5">${escapeXml(overline)}</text>
      <text x="${PAD}" y="72" fill="#f0f6fc" font-size="21" font-weight="800">${escapeXml(title)}</text>
      ${rows}
      <text x="${PAD}" y="${height - 14}" fill="#6e7681" font-size="10" letter-spacing="1">UPDATED DAILY · GITHUB ACTIONS · ${escapeXml(timezone.toUpperCase())}</text>
    </svg>
  `;
}

function sumLast(n, recentDays) {
  return recentDays.slice(-n).reduce((sum, day) => sum + day.contributionCount, 0);
}

function makeTrend(title, days, generatedLabel) {
  const W = 1200;
  const H = 320;
  const padL = 56;
  const padR = 28;
  const padT = 56;
  const padB = 48;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const max = Math.max(1, ...days.map((d) => d.contributionCount));
  const n = days.length;
  const stepX = n > 1 ? plotW / (n - 1) : 0;
  const yFor = (count) => padT + plotH - (count / max) * plotH;
  const xFor = (i) => padL + i * stepX;

  const linePath = days
    .map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(d.contributionCount).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${xFor(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${xFor(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  const gridSteps = 4;
  const gridlines = Array.from({ length: gridSteps + 1 }, (_, g) => {
    const value = Math.round((max * g) / gridSteps);
    const y = yFor((max * g) / gridSteps);
    return `
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#21262d" stroke-width="1"/>
      <text x="${padL - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#8b949e" font-size="12">${value}</text>
    `;
  }).join("");

  const first = days[0]?.date ?? "";
  const last = days[n - 1]?.date ?? "";
  const peak = days.reduce((a, b) => (b.contributionCount > a.contributionCount ? b : a), days[0]);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320" viewBox="0 0 1200 320">
      <rect width="1200" height="320" rx="16" fill="#0d1117" stroke="#30363d"/>
      <text x="32" y="38" fill="#58a6ff" font-size="19" font-weight="700">${escapeXml(title)}</text>
      <text x="1168" y="38" text-anchor="end" fill="#8b949e" font-size="12">${escapeXml(first)} → ${escapeXml(last)}</text>
      ${gridlines}
      <path d="${areaPath}" fill="#58a6ff" opacity="0.15"/>
      <path d="${linePath}" fill="none" stroke="#58a6ff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${days.map((d, i) => `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(d.contributionCount).toFixed(1)}" r="3" fill="#0d1117" stroke="#58a6ff" stroke-width="1.5"><title>${escapeXml(d.date)}: ${d.contributionCount} contributions</title></circle>`).join("")}
      <text x="${padL}" y="${H - 16}" fill="#8b949e" font-size="12">${escapeXml(first)}</text>
      <text x="${W - padR}" y="${H - 16}" text-anchor="end" fill="#8b949e" font-size="12">${escapeXml(last)}</text>
      <text x="${W / 2}" y="${H - 16}" text-anchor="middle" fill="#8b949e" font-size="12">Peak ${peak.contributionCount} on ${escapeXml(peak.date)} · ${escapeXml(generatedLabel)}</text>
    </svg>
  `;
}

function writeSvgSafe(filePath, svg) {
  if (!svg.trimStart().startsWith("<svg") && !svg.includes("<svg")) {
    throw new Error(`Refusing to write invalid SVG to ${filePath}`);
  }
  if (svg.length < 500) {
    throw new Error(`Refusing to write suspiciously small SVG to ${filePath} (${svg.length} bytes)`);
  }
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, svg);
  fs.renameSync(tmp, filePath);
}

async function githubGraphQL(query, variables = {}) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  if (!response.ok || result.errors?.length) {
    throw new Error(JSON.stringify(result.errors ?? result, null, 2));
  }

  return result.data;
}

async function main() {
  const today = getLocalDate();
  const fromDate = shiftDate(today, -364);

  // Contribution calendar for the last 365 days.
  const contributionQuery = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const contributionData = await githubGraphQL(contributionQuery, {
    login: username,
    from: `${fromDate}T00:00:00+07:00`,
    to: `${today}T23:59:59+07:00`,
  });

  const calendar =
    contributionData.user.contributionsCollection.contributionCalendar;

  const recentDays = calendar.weeks
    .flatMap((week) => week.contributionDays)
    .filter((day) => day.date >= fromDate && day.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (recentDays.length === 0) {
    throw new Error("GitHub returned no contribution calendar days.");
  }

  const total = recentDays.reduce(
    (sum, day) => sum + day.contributionCount,
    0
  );

  const activeDays = recentDays.filter((day) => day.contributionCount > 0).length;
  const avgPerActiveDay = activeDays > 0 ? (total / activeDays).toFixed(1) : "0.0";

  const countByDate = new Map(
    recentDays.map((day) => [day.date, day.contributionCount])
  );

  // If today has no contributions yet, count the streak through yesterday.
  const streakEnd =
    (countByDate.get(today) ?? 0) > 0
      ? today
      : shiftDate(today, -1);

  let currentStreak = 0;

  if ((countByDate.get(streakEnd) ?? 0) > 0) {
    for (let date = streakEnd; ; date = shiftDate(date, -1)) {
      if ((countByDate.get(date) ?? 0) === 0) break;
      currentStreak++;
    }
  }

  let longestStreak = 0;
  let runningStreak = 0;

  for (const day of recentDays) {
    if (day.contributionCount > 0) {
      runningStreak++;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  }

  // Aggregate languages from up to 100 public, non-fork repositories.
  const languageQuery = `
    query($login: String!) {
      user(login: $login) {
        repositories(
          first: 100
          privacy: PUBLIC
          isFork: false
          ownerAffiliations: OWNER
          orderBy: { field: UPDATED_AT, direction: DESC }
        ) {
          nodes {
            name
            languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
              edges {
                size
                node {
                  name
                  color
                }
              }
            }
          }
        }
      }
    }
  `;

  const languageData = await githubGraphQL(languageQuery, {
    login: username,
  });

  const repositories = languageData.user.repositories.nodes;
  const languageTotals = new Map();
  let totalBytes = 0;

  for (const repo of repositories) {
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      const previous = languageTotals.get(name) ?? {
        bytes: 0,
        color: edge.node.color || "#8b949e",
      };

      previous.bytes += edge.size;
      languageTotals.set(name, previous);
      totalBytes += edge.size;
    }
  }

  const topLanguages = [...languageTotals.entries()]
    .map(([name, data]) => ({
      label: name,
      pct: totalBytes > 0 ? (data.bytes / totalBytes) * 100 : 0,
      value: totalBytes > 0
        ? `${((data.bytes / totalBytes) * 100).toFixed(1)}%`
        : "0.0%",
      color: data.color,
      bytes: data.bytes,
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);

  const generatedLabel = `Generated ${today} · ${timezone}`;
  const last31 = recentDays.slice(-31);

  fs.mkdirSync("profile", { recursive: true });

  writeSvgSafe(
    path.join("profile", "stats.svg"),
    makeCard("OVERVIEW", "GitHub Contributions", [
      {
        label: "Contributions · Last 365 Days",
        value: total.toLocaleString("en-US"),
      },
      {
        label: "Active Days · Last 365 Days",
        value: `${activeDays} days`,
      },
      {
        label: "Average · Per Active Day",
        value: `${avgPerActiveDay}`,
      },
    ])
  );

  writeSvgSafe(
    path.join("profile", "streak.svg"),
    makeCard("CONSISTENCY", "Contribution Streak", [
      { label: "Current Streak", value: `${currentStreak} days` },
      { label: "Longest · Last 365 Days", value: `${longestStreak} days` },
    ])
  );

  writeSvgSafe(
    path.join("profile", "top-langs.svg"),
    makeCard(
      "STACK FOCUS",
      "Top Languages",
      topLanguages.length > 0
        ? topLanguages.map(({ label, value, pct, color }) => ({
            label,
            value,
            dot: color,
            bar: { pct, color },
          }))
        : [{ label: "No language data available", value: "—" }]
    )
  );

  writeSvgSafe(
    path.join("profile", "activity-trend.svg"),
    makeTrend("Activity Trend · Last 31 Days", last31, generatedLabel)
  );

  writeSvgSafe(
    path.join("profile", "activity-summary.svg"),
    makeCard("VELOCITY", "Activity Summary", [
      { label: "Last 7 Days", value: sumLast(7, recentDays).toLocaleString("en-US") },
      { label: "Last 30 Days", value: sumLast(30, recentDays).toLocaleString("en-US") },
      { label: "Last 90 Days", value: sumLast(90, recentDays).toLocaleString("en-US") },
      { label: "Last 365 Days", value: total.toLocaleString("en-US") },
    ])
  );

  console.log(`Updated statistics for ${username}`);
  console.log(`Contributions in last 365 days: ${total}`);
  console.log(`Active days: ${activeDays} (avg ${avgPerActiveDay}/day)`);
  console.log(`Current streak: ${currentStreak} days`);
  console.log(`Longest streak in last 365 days: ${longestStreak} days`);
  console.log(`Last 7/30/90 days: ${sumLast(7, recentDays)}/${sumLast(30, recentDays)}/${sumLast(90, recentDays)}`);
  console.log(`Repositories analyzed: ${repositories.length}`);
  console.log("Top languages:", topLanguages.map((lang) => lang.label).join(", "));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
