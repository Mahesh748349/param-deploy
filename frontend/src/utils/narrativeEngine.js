/**
 * Instant Natural Language Generator (NLG) Engine
 * Transforms raw JSON telemetry, CSV rows, and attributes into fluent, human-readable English narratives.
 */

// Helper: title case strings like "color-perception" -> "Color Perception"
export function formatName(str) {
  if (!str) return 'Unknown Exhibit';
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Helper: format duration into human-readable words
export function describeDuration(secondsStr) {
  const sec = parseFloat(secondsStr);
  if (isNaN(sec)) return `${secondsStr} seconds`;
  if (sec < 60) return `${sec.toFixed(0)} seconds`;
  const mins = Math.floor(sec / 60);
  const remSec = Math.round(sec % 60);
  return `${mins} minute${mins === 1 ? '' : 's'}${remSec > 0 ? ` and ${remSec} second${remSec === 1 ? '' : 's'}` : ''} (${sec.toFixed(1)}s)`;
}

// Helper: format ISO dates into friendly text
export function formatFriendlyDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr.slice(0, 19).replace('T', ' ');
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    }) + ' UTC';
  } catch {
    return isoStr;
  }
}

/**
 * Extracts key-value attributes from either the `attributes` object
 * or by parsing JSON embedded in the text snippet.
 */
export function extractRecordData(result) {
  let data = { ...(result.attributes || {}) };

  // If attributes are empty or partial, try parsing raw text for JSON
  if (result.text && typeof result.text === 'string') {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        data = { ...parsed, ...data };
      } catch {
        // ignore parse error
      }
    }
  }
  return data;
}

/**
 * Generates a natural-sounding English paragraph for a single telemetry record.
 */
export function generateSingleRecordNarrative(result) {
  const data = extractRecordData(result);

  const exhibit = formatName(data.display_name || data.exhibit_id || data.station);
  const durationSec = parseFloat(data.duration_s || data.duration || 0);
  const presses = parseInt(data.presses || data.clicks || data.interactions, 10);
  const dateStr = formatFriendlyDate(data.started_at || data.recorded_at || data.timestamp);

  // If this is an engagement session with duration & presses
  if (data.exhibit_id || data.duration_s || !isNaN(presses)) {
    let intensity = '';
    if (!isNaN(presses) && durationSec > 0) {
      const pressesPerMin = Math.round((presses / (durationSec / 60)) || 0);
      if (presses > 200 || pressesPerMin > 20) {
        intensity = `reflecting deep, continuous exploration (${pressesPerMin} interactions per minute)`;
      } else if (presses > 20) {
        intensity = `with regular interactive participation`;
      } else {
        intensity = `with a brief exploratory check-in`;
      }
    }

    const durationText = describeDuration(durationSec);
    const datePhrase = dateStr ? ` on ${dateStr}` : '';
    const pressesText = !isNaN(presses) ? `logged ${presses.toLocaleString()} button/touch presses` : 'interacted with the station';

    return `At the ${exhibit} station, a visitor engaged in a session lasting ${durationText}${datePhrase}. During this interaction, the participant ${pressesText}${intensity ? `, ${intensity}` : ''}.`;
  }

  // Fallback for general text or non-telemetry records
  if (result.text) {
    const clean = result.text.replace(/^Source:.*?;\s*(?:row|sheet):[^\n]+\n?/i, '').trim();
    if (clean.startsWith('{')) {
      // Formatted list of key values
      try {
        const parsed = JSON.parse(clean);
        const statements = Object.entries(parsed)
          .slice(0, 5)
          .map(([k, v]) => `${formatName(k)}: ${v}`)
          .join(', ');
        return `Recorded event at ${result.source || 'dataset'}: ${statements}.`;
      } catch {
        return clean;
      }
    }
    return clean;
  }

  return 'No telemetry data available for this record.';
}

/**
 * Generates an executive synthesis across all retrieved records.
 */
export function generateExecutiveSummary(query, results = []) {
  if (!results || results.length === 0) {
    return 'No relevant records found to synthesize.';
  }

  const validRecords = results.map(extractRecordData);
  const exhibits = [...new Set(validRecords.map((r) => formatName(r.display_name || r.exhibit_id)).filter(Boolean))];
  
  let totalDurationSec = 0;
  let totalPresses = 0;
  let countWithDuration = 0;
  let countWithPresses = 0;

  validRecords.forEach((r) => {
    const d = parseFloat(r.duration_s || r.duration);
    if (!isNaN(d) && d > 0) {
      totalDurationSec += d;
      countWithDuration++;
    }
    const p = parseInt(r.presses || r.clicks, 10);
    if (!isNaN(p) && p >= 0) {
      totalPresses += p;
      countWithPresses++;
    }
  });

  const exhibitList = exhibits.length > 0 ? exhibits.join(', ') : 'the designated exhibit stations';
  const totalMins = (totalDurationSec / 60).toFixed(1);
  const avgMins = countWithDuration > 0 ? (totalDurationSec / countWithDuration / 60).toFixed(1) : '0';

  let summary = `Across the ${results.length} retrieved record(s) matching "${query}", visitor activity was centered at ${exhibitList}.\n\n`;

  if (countWithDuration > 0) {
    summary += `• **Engagement Time:** Visitors logged a combined dwell time of **${totalMins} minutes** (${totalDurationSec.toFixed(0)} seconds), with an average session duration of **${avgMins} minutes**.\n`;
  }

  if (countWithPresses > 0) {
    summary += `• **Interaction Frequency:** A total of **${totalPresses.toLocaleString()} button presses and sensor touches** were recorded across these sessions, demonstrating sustained physical interaction.\n`;
  }

  summary += `• **Primary Finding:** The telemetry confirms that visitors actively test and explore the interactive stations rather than merely passing through.`;

  return summary;
}
