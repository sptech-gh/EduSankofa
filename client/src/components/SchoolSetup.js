import React from "react";
import { useNavigate } from "react-router-dom";

// School Setup Hub View
// EduSankofa Basic School Management System

function SchoolSetup() {
  const navigate = useNavigate();

  const items = [
    { title: "Academic Years", path: "/school-setup/academic-years", icon: "📅", desc: "Manage academic terms and calendar settings." },
    { title: "Terms", path: "/school-setup/terms", icon: "⏳", desc: "Manage school terms and active periods." },
    { title: "Classes", path: "/school-setup/classes", icon: "🏫", desc: "Configure class streams and student allocations." },
    { title: "Teacher Assignments", path: "/school-setup/teacher-assignments", icon: "🧑‍🏫", desc: "Assign teachers to subjects and class streams." },
    { title: "School Profile", path: "/school-setup/school-profile", icon: "🏢", desc: "Set up name, contact, and official address details." },
    { title: "Grading Settings", path: "/school-setup/grading-settings", icon: "⚙️", desc: "Define grading scales and weighted systems." },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">School Setup</h1>
        <button onClick={() => navigate("/dashboard")} className="btn btn-ghost">
          ← Back to Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="card p-6 text-left hover:border-primary-500 dark:hover:border-primary-400 hover:ring-1 hover:ring-primary-500 transition-all duration-300 group flex items-start space-x-4 bg-white dark:bg-neutral-800"
          >
            <div className="text-2xl p-3 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-xl transition-colors duration-300 group-hover:bg-primary-200 dark:group-hover:bg-primary-900/40">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white truncate group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors duration-300">
                {item.title}
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                {item.desc}
              </p>
              <span className="inline-flex items-center text-xs font-semibold text-primary-700 dark:text-primary-300 mt-3 group-hover:underline">
                Open Settings →
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default SchoolSetup;
