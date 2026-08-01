import React, { useState, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../edusankofa/utils/cn";

// Role-aware Sidebar Navigation — EduSankofa School Management System

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (raw === "accounts_officer" || raw === "accounts-officer") return "accounts officer";
  return raw;
};

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return {
      ...u,
      role: normalizeRole(u.role || ""),
      secondaryRoles: Array.isArray(u.secondaryRoles)
        ? u.secondaryRoles.map(normalizeRole)
        : [],
    };
  } catch (_) { return null; }
};

const getRoleLabel = (role) => {
  const map = {
    "admin": "Administrator", "school admin": "School Admin",
    "super admin": "Super Admin", "headmaster": "Headmaster", "proprietor": "Proprietor",
    "staff": "Staff Member",
    "teacher": "Teacher", "accountant": "Accountant",
    "accounts officer": "Accounts Officer", "parent": "Parent", "student": "Student",
  };
  return map[role] || role || "Unknown";
};

// ─── Role groups (undefined = all authenticated users) ──────────────────────
const ADMIN_ROLES = ["admin", "school admin", "super admin", "headmaster", "proprietor"];
const FINANCIAL_ROLES = ["admin", "school admin", "super admin", "headmaster", "proprietor", "staff", "accounts officer", "accountant"];
const ACCOUNTANT_ONLY = ["accountant", "accounts officer"];
const ACADEMIC_ROLES = ["admin", "school admin", "super admin", "headmaster", "proprietor", "staff", "teacher"];
const SETUP_ROLES = ["admin", "school admin", "super admin", "staff"];

// Expand a user's effective roles: primary + secondary (cross-role) + equivalence
const expandUserRoles = (userRole, secondaryRoles = []) => {
  const roles = new Set([normalizeRole(userRole)]);
  (secondaryRoles || []).forEach((r) => roles.add(normalizeRole(r)));

  // Admin/School Admin are interchangeable in authorization checks
  const normalized = [...roles];
  if (normalized.includes("admin")) roles.add("school admin");
  if (normalized.includes("school admin")) roles.add("admin");

  return [...roles];
};

const isAllowed = (allowedRoles, userRole, secondaryRoles = []) => {
  if (!allowedRoles) return true;
  const allowed = allowedRoles.map(r => normalizeRole(r));
  const effective = expandUserRoles(userRole, secondaryRoles);
  return effective.some(r => allowed.includes(r));
};

// ─── Navigation definition ─────────────────────────────────────────────────────
const buildNavigation = (userRole) => {
  const role = String(userRole || "").trim().toLowerCase();

  if (role === "headmaster" || role === "proprietor") {
    return [
      {
        title: "Executive Portal",
        items: [
          {
            name: "Overview", href: "/headmaster",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>),
          },
          {
            name: "Finances", href: "/headmaster/finance",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
          },
          {
            name: "Budget", href: "/headmaster/budget",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>),
          },
          {
            name: "Approvals", href: "/headmaster/approvals",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
          },
          {
            name: "Academic", href: "/headmaster/academic",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>),
          },
          {
            name: "People", href: "/headmaster/people",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>),
          },
        ],
      },
      {
        title: "Communication",
        key: "communication",
        items: [
          {
            name: "Messages", href: "/messages",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>),
          },
          {
            name: "Announcements", href: "/announcements",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>),
          },
        ],
      },
    ];
  }

  if (role === "parent") {
    return [
      {
        title: "Parent Portal",
        items: [
          {
            name: "Overview", href: "/parent",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>),
          },
          {
            name: "Fees & Billing", href: "/parent/billing",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
          },
          {
            name: "Attendance", href: "/parent/attendance",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>),
          },
          {
            name: "Results", href: "/parent/results",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>),
          },
          {
            name: "Notices", href: "/parent/notices",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>),
          },
        ],
      },
      {
        title: "Communication",
        key: "communication",
        items: [
          {
            name: "Messages", href: "/messages",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>),
          },
        ],
      },
    ];
  }

  if (role === "teacher" || role === "class teacher") {
    return [
      {
        title: "Teacher Portal",
        items: [
          {
            name: "Dashboard", href: "/teacher",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>),
          },
          {
            name: "Attendance", href: "/teacher/attendance",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>),
          },
          {
            name: "Score Entry", href: "/teacher/scores",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>),
          },
          {
            name: "Report Cards", href: "/teacher/reports",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v8m3-2h6m-6 4h6" /></svg>),
          },
          {
            name: "Class Billing", href: "/teacher/billing",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
          },
        ],
      },
      {
        title: "Communication",
        key: "communication",
        items: [
          {
            name: "Messages", href: "/messages",
            icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>),
          },
        ],
      },
    ];
  }

  return [
    {
      title: "Main",
      items: [
        {
          name: "Dashboard", href: "/dashboard",
          allowedRoles: ["admin", "school admin", "super admin", "staff", "teacher"],
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>),
        },
        {
          name: "Analytics", href: "/dashboard-analytics",
          allowedRoles: ["admin", "school admin", "super admin", "staff"],
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>),
        },
      ],
    },
    {
      title: "Accountant",
      key: "accountant_section",
      allowedRoles: ACCOUNTANT_ONLY,
      items: [
        {
          name: "Accountant Portal", href: "/accountant",
          allowedRoles: ACCOUNTANT_ONLY,
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>),
        },
      ],
    },
    {
      title: "Academic",
      key: "academic",
      allowedRoles: ACADEMIC_ROLES,
      items: [
        {
          name: "Students", href: "/students", allowedRoles: ACADEMIC_ROLES,
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>),
        },
        {
          name: "Grades", href: "/grades", allowedRoles: ACADEMIC_ROLES,
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>),
        },
        {
          name: "Subjects", href: "/subjects", allowedRoles: ["admin", "school admin", "super admin", "staff"],
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>),
        },
        {
          name: "Attendance", href: "/attendance", allowedRoles: ACADEMIC_ROLES,
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>),
        },
        {
          name: "Report Cards", href: "/report-cards", allowedRoles: ACADEMIC_ROLES,
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v8m3-2h6m-6 4h6" /></svg>),
        },
      ],
    },
    {
      title: "Financial",
      key: "financial",
      allowedRoles: FINANCIAL_ROLES,
      items: [
        {
          name: "Fee Configuration", href: "/admin/fees", allowedRoles: ADMIN_ROLES,
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>),
        },
        {
          name: "Fees Management", href: "/fees", allowedRoles: FINANCIAL_ROLES,
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
        },
        {
          name: "Payments", href: "/payments", allowedRoles: FINANCIAL_ROLES,
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>),
        },
      ],
    },
    {
      title: "Communication",
      key: "communication",
      items: [
        {
          name: "Messages", href: "/messages",
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>),
        },
        {
          name: "Announcements", href: "/announcements",
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>),
        },
        {
          name: "Notifications", href: "/notifications",
          allowedRoles: ["admin", "school admin", "super admin", "staff", "teacher"],
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>),
        },
      ],
    },
    {
      title: "School Setup",
      key: "system",
      allowedRoles: SETUP_ROLES,
      items: [
        { name: "Academic Years", href: "/school-setup/academic-years", allowedRoles: SETUP_ROLES, icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>) },
        { name: "Terms", href: "/school-setup/terms", allowedRoles: SETUP_ROLES, icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>) },
        { name: "Classes", href: "/school-setup/classes", allowedRoles: SETUP_ROLES, icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>) },
        { name: "Teacher Assignments", href: "/school-setup/teacher-assignments", allowedRoles: SETUP_ROLES, icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>) },
        { name: "School Profile", href: "/school-setup/school-profile", allowedRoles: SETUP_ROLES, icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>) },
        { name: "Grading Settings", href: "/school-setup/grading-settings", allowedRoles: SETUP_ROLES, icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>) },
      ],
    },
    {
      title: "System",
      allowedRoles: ["admin", "school admin", "super admin", "staff"],
      items: [
        {
          name: "Promotion", href: "/promotion", allowedRoles: ["admin", "school admin", "super admin", "staff"],
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
        },
        {
          name: "System Settings", href: "/system-settings", allowedRoles: ADMIN_ROLES,
          icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>),
        },
      ],
    },
  ];
};

// ─── Main Component ────────────────────────────────────────────────────────────
const Sidebar = ({ isOpen, onToggle, isMobile }) => {
  const [expandedSections, setExpandedSections] = useState({
    accountant_section: true,
    academic: true,
    financial: false,
    communication: false,
    system: false,
  });

  const currentUser = useMemo(() => getCurrentUser(), []);
  const userRole = currentUser?.role || "";
  const userSecondaryRoles = currentUser?.secondaryRoles || [];
  const navigation = useMemo(() => buildNavigation(userRole), [userRole]);

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const visibleSections = navigation.filter(section => {
    if (!isAllowed(section.allowedRoles, userRole, userSecondaryRoles)) return false;
    return section.items.some(item => isAllowed(item.allowedRoles, userRole, userSecondaryRoles));
  });

  return (
    <>
      {isMobile && isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onToggle} />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 transform transition-transform duration-300 ease-in-out flex flex-col",
          "md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-neutral-900 dark:text-white">EduSankofa</span>
          </div>
          <button onClick={onToggle} className="md:hidden p-2 rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Role badge */}
        {userRole && (
          <div className="px-4 py-2 border-b border-neutral-100 dark:border-neutral-700 flex-shrink-0">
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
              (userRole === "accountant" || userRole === "accounts officer")
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                : (userRole === "admin" || userRole === "school admin" || userRole === "super admin")
                ? "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                : userRole === "teacher"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
            )}>
              {getRoleLabel(userRole)}
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
          {visibleSections.map((section) => {
            const visibleItems = section.items.filter(item => isAllowed(item.allowedRoles, userRole, userSecondaryRoles));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                {section.key ? (
                  <button
                    onClick={() => toggleSection(section.key)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors duration-200"
                  >
                    <span>{section.title}</span>
                    <svg className={cn("w-4 h-4 transform transition-transform duration-200", expandedSections[section.key] ? "rotate-90" : "")}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <p className="px-3 py-1 text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{section.title}</p>
                )}

                <div className={cn("mt-1 space-y-1", section.key && !expandedSections[section.key] && "hidden")}>
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200",
                          isActive
                            ? "bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                            : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700",
                        )
                      }
                    >
                      <span className="flex-shrink-0 w-5 h-5 mr-3">{item.icon}</span>
                      <span className="flex-1">{item.name}</span>
                      {item.badge && (
                        <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-300">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer — real user info */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <div className="flex items-center space-x-3 px-3 py-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                {currentUser?.name || currentUser?.email || "User"}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {getRoleLabel(userRole)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
