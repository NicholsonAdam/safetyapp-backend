require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const path = require("path");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

const PORT = 3000;

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
app.use("/api/inspection", require("./routes/inspection"));   // ⭐ NOW THIS WORKS

// ⭐ GENERIC /api ROUTES LAST
app.use('/api', healthcheckRoute);
app.use('/api', testEmailRoute);
app.use('/api', photosRoute);

// STATIC FILES
app.use("/huddles/pdf", express.static(path.join(__dirname, "huddles/pdf")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ERROR HANDLER
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// SERVER LISTEN
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Safety App backend listening on http://0.0.0.0:${PORT}`);
});