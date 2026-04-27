require('dotenv').config();

const fs = require("fs");
const express = require('express');
const cors = require('cors');
const app = express();
const path = require("path");

// Ensure /data/uploads exists
const uploadDir = "/data/uploads";
fs.mkdirSync(uploadDir, { recursive: true });

// ⭐ FIXED CORS — PATCH ADDED + OPTIONS ENABLED
app.use(
  cors({
    origin: "https://safetyapp-frontend.onrender.com",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ⭐ STATIC FILE SERVING FOR DOCUMENTS (THIS FIXES YOUR 404)
app.use("/api/data/documents", express.static(path.join(__dirname, "data/documents")));

// ⭐ FILE SERVING FOR PERMANENT UPLOADS
app.get("/files/:filename", (req, res) => {
  const filePath = path.join("/data/uploads", req.params.filename);
  res.sendFile(filePath);
});

// ROUTES
const healthcheckRoute = require('./routes/healthcheck');
const observationsRoute = require('./routes/observations');
const dbTestRoute = require('./routes/dbtest');
const photosRoute = require('./routes/photos');
const assignmentsRoute = require('./routes/observationAssignmentsRoutes');
const dashboardRoute = require('./routes/dashboardRoutes');
const escalationRoute = require('./routes/escalationRoutes');
const testEmailRoute = require('./routes/testEmailRoute');
const authRoute = require('./routes/auth');
const supportRoutes = require('./routes/supportRoutes');
const documentFoldersRoutes = require("./routes/documentFolders");
const documentsRoutes = require("./routes/documents");
const documentVersionsRoutes = require("./routes/documentVersions");
const trainingRoutes = require("./routes/training");
const documentSignaturesRoutes = require("./routes/documentSignatures");

// ⭐ LOAD MONTHLY ROLLOVER CRON JOB
require('./cron/submissionRequirementsCron');

const PORT = process.env.PORT || 3000;

// ⭐ SPECIFIC ROUTES FIRST
app.use('/api/observations', observationsRoute);
app.use('/api/dbtest', dbTestRoute);
app.use('/api/assignments', assignmentsRoute);
app.use("/api/huddles", require("./routes/huddles"));
app.use('/api/dashboard', dashboardRoute);
app.use('/api/escalation', escalationRoute);
app.use("/api/support", supportRoutes);
app.use('/api/auth', authRoute);
app.use("/api/employees", require("./routes/employees"));
app.use("/api/employees", require("./routes/employeesExport"));
app.use('/api/bbs', require('./routes/bbs'));
app.use("/api/nearmiss", require("./routes/nearmiss"));
app.use("/api/inspection", require("./routes/inspection"));
app.use('/api/submission-requirements', require('./routes/submissionRequirements'));
app.use("/api/folders", documentFoldersRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/documentVersions", documentVersionsRoutes);
app.use("/api/signatures", documentSignaturesRoutes);
app.use("/api/training", trainingRoutes);

// ⭐ GENERIC /api ROUTES LAST
app.use('/api', healthcheckRoute);
app.use('/api', testEmailRoute);
app.use('/api', photosRoute);

// STATIC FILES
// ⭐ STATIC FILE SERVING FOR DOCUMENTS (FINAL FIX)
app.use("/api/data/documents", express.static("/data/documents"));
app.use("/huddles/pdf", express.static(path.join(__dirname, "huddles/pdf")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ERROR HANDLER
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// SERVER LISTEN
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Safety App backend listening on http://0.0.0.0:${PORT}`);
});
