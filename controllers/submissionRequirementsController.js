const model = require('../models/submissionRequirementsModel');

// GET all
const getAll = async (req, res) => {
    try {
        const data = await model.getAllSubmissionRequirements();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch submission requirements' });
    }
};

// POST create
const create = async (req, res) => {
    try {
        const { employee_id, required_count, year, month } = req.body;

        if (!employee_id || !year || !month) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newRecord = await model.createSubmissionRequirement({
            employee_id,
            required_count: required_count ?? 0,
            year,
            month
        });

        res.status(201).json(newRecord);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create submission requirement' });
    }
};

// UPDATE requirement
const update = async (req, res) => {
    try {
        const { employee_id, year, month, required_count } = req.body;

        const updated = await model.updateSubmissionRequirement(
            employee_id,
            year,
            month,
            required_count
        );

        if (!updated) {
            return res.status(404).json({ error: "Record not found" });
        }

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update submission requirement" });
    }
};

// DELETE requirement
const remove = async (req, res) => {
    try {
        const { employee_id, year, month } = req.body;

        const deleted = await model.deleteSubmissionRequirement(
            employee_id,
            year,
            month
        );

        if (!deleted) {
            return res.status(404).json({ error: "Record not found" });
        }

        res.json({ message: "Deleted successfully", deleted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete submission requirement" });
    }
};

module.exports = { getAll, create, update, remove };
