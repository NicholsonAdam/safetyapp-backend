const service = require("../services/leaderSignaturesService");

exports.getAll = async (req, res) => {
  try {
    const result = await service.getAllSignatureStatus();
    res.json(result.rows);
  } catch (err) {
    console.error("Error loading leader signatures:", err);
    res.status(500).json({ message: "Failed to load signature dashboard." });
  }
};
