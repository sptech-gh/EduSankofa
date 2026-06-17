// Utility function for combining Tailwind CSS classes
// EduSankofa Basic School Management System

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default cn;
