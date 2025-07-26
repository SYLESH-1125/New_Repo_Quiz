// Chart.js dynamic imports for dashboard analytics
import dynamic from "next/dynamic";
export const Line = dynamic(() => import("react-chartjs-2").then(mod => mod.Line), { ssr: false });
export const Radar = dynamic(() => import("react-chartjs-2").then(mod => mod.Radar), { ssr: false });
export const Pie = dynamic(() => import("react-chartjs-2").then(mod => mod.Pie), { ssr: false });
