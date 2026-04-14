const cleanObject = (value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(cleanObject);
  }

  const cleaned = {};

  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".")) {
      continue;
    }

    cleaned[key] = cleanObject(value[key]);
  }

  return cleaned;
};

export const sanitizeNoSql = (req, res, next) => {
  if (req.body) {
    req.body = cleanObject(req.body);
  }

  next();
};