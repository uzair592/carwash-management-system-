function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}
function bounds(day) {
  const start = new Date(day + 'T00:00:00+05:00');
  if (!Number.isFinite(start.getTime()) || dayKey(start) !== day) throw Object.assign(new Error('Invalid calendar date.'), {
    status: 400
  });
  return {
    start,
    end: new Date(start.getTime() + 86400000 - 1)
  };
}
function monthBounds(key) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) throw Object.assign(new Error('Choose month YYYY-MM.'), {
    status: 400
  });
  const [y, m] = key.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - 5 * 3600000),
    end: new Date(Date.UTC(y, m, 1) - 5 * 3600000 - 1)
  };
}
function rangeDates({
  range = 'month',
  from,
  to
} = {}) {
  const today = dayKey();
  let start, end;
  if (range === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) throw Object.assign(new Error('Select valid start and end dates.'), {
      status: 400
    });
    start = bounds(from).start;
    end = bounds(to).end;
  } else if (range === 'today') ({
    start,
    end
  } = bounds(today));else if (range === 'yesterday') ({
    start,
    end
  } = bounds(dayKey(new Date(Date.now() - 86400000))));else if (range === 'all') {
    start = new Date('2000-01-01');
    end = new Date();
  } else if (range === 'week') {
    end = bounds(today).end;
    const weekday = new Date(today + 'T12:00:00+05:00').getUTCDay();
    start = new Date(bounds(today).start.getTime() - (weekday + 6) % 7 * 86400000);
  } else {
    let key = today.slice(0, 7);
    if (range === 'last_month') {
      const [y, m] = key.split('-').map(Number);
      key = dayKey(new Date(Date.UTC(y, m - 1, 0, 12))).slice(0, 7);
    }
    ({
      start,
      end
    } = monthBounds(key));
  }
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) throw Object.assign(new Error('Invalid report date range.'), {
    status: 400
  });
  return {
    start,
    end
  };
}
module.exports = {
  dayKey,
  bounds,
  monthBounds,
  rangeDates
};
