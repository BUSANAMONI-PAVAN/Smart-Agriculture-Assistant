export function classifyIrrigationAlert(forecast) {
  if (forecast.rainChance24h >= 75 || forecast.rainMm24h >= 15) {
    return {
      type: 'weather',
      level: 'high',
      title: 'Irrigation Hold Reminder',
      message: 'Heavy rain likely. Pause irrigation and open drainage channels today.',
    };
  }

  if (forecast.rainChance24h <= 20 && forecast.maxTemp >= 35) {
    return {
      type: 'weather',
      level: 'medium',
      title: 'Irrigation Boost Reminder',
      message: 'Dry and warm conditions expected. Shift watering to morning/evening in split cycles.',
    };
  }

  return null;
}

export function buildLifecycleAlerts(profile) {
  const reminders = [];
  const plans = Array.isArray(profile.cropPlans) ? profile.cropPlans : [];

  for (const plan of plans) {
    const sowingTime = Date.parse(plan.sowingDate);
    if (Number.isNaN(sowingTime)) continue;

    const days = Math.floor((Date.now() - sowingTime) / (24 * 60 * 60 * 1000));
    const crop = String(plan.cropName || 'crop');

    if (days === 14 || days === 15) {
      reminders.push({
        type: 'lifecycle',
        level: 'medium',
        title: `${crop.toUpperCase()} Nutrient Reminder`,
        message: `Day ${days}: inspect crop stand and apply first top-dressing based on soil test recommendation.`,
      });
    }

    if (days >= 28 && days <= 32) {
      reminders.push({
        type: 'lifecycle',
        level: 'medium',
        title: `${crop.toUpperCase()} Pest Scouting Reminder`,
        message: `Day ${days}: run pest scouting across 5 field points and record infestation threshold.`,
      });
    }

    if (days >= 65 && days <= 72) {
      reminders.push({
        type: 'lifecycle',
        level: 'low',
        title: `${crop.toUpperCase()} Harvest Planning`,
        message: `Prepare labor, storage, and market route for upcoming harvest cycle.`,
      });
    }
  }

  if (!reminders.length) {
    reminders.push({
      type: 'lifecycle',
      level: 'low',
      title: 'Weekly Crop Check',
      message: 'Record crop growth stage, pest signs, and moisture status for better recommendations.',
    });
  }

  return reminders;
}

export function buildPersonalizedRecommendation(profile) {
  const crops = Array.isArray(profile.crops) ? profile.crops : [];
  const location = profile.location || 'your region';
  if (!crops.length) {
    return {
      type: 'crop',
      level: 'low',
      title: 'Add Crop Profile for Better Advice',
      message: 'Update your crop profile to receive stage-specific advisories and reminders.',
    };
  }

  const topCrop = String(crops[0]);
  return {
    type: 'crop',
    level: 'medium',
    title: 'Personalized Recommendation',
    message: `For ${topCrop} in ${location}, review market trend and schedule next irrigation using weather advisory.`,
  };
}

export function buildDiseaseFollowUpAlerts(scans, profile) {
  const alerts = [];
  const location = profile.location || 'your farm';

  for (const scan of scans.slice(0, 2)) {
    alerts.push({
      type: 'disease',
      level: 'high',
      title: `Follow-up Required: ${String(scan.diseaseKey).replaceAll('_', ' ').toUpperCase()}`,
      message: `High-risk disease reported in ${location}. Re-inspect field and repeat treatment plan within 24 hours.`,
    });
  }

  return alerts;
}
