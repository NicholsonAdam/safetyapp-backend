const model = require('../models/submissionRequirementsProgressModel');

exports.getProgress = async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required" });
    }

    const data = await model.getSubmissionProgress(month, year);
    res.json(data);
  } catch (err) {
    console.error("Error fetching submission progress:", err);
    res.status(500).json({ error: "Server error" });
  }
};
