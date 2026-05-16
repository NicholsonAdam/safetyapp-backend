module.exports = (err, req, res, next) => {
  const status = err.status || 500;

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} — ${err.message}`);
  if (err.stack) console.error(err.stack);

  // In production, hide internal error details from the client
  const message = status < 500
    ? err.message
    : process.env.NODE_ENV === "production"
      ? "An internal server error occurred"
      : err.message;

  res.status(status).json({
    status: "error",
    message,
  });
};