// src/pages/ReportGenerationPage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Define interfaces for data
interface User {
  id: number;
  name: string;
  role: string;
  created_at: string;
  avatar: string;
}

interface Announcement {
  id: number;
  message: string;
  sender_id: number;
  sent_at: string;
  sender_name: string;
}

const ReportGenerationPage: React.FC = () => {
  const navigate = useNavigate();

  // State for report selection and date range
  const [reportType, setReportType] = useState<
    "users" | "announcements" | null
  >(null);
  const [startDate, setStartDate] = useState<Date | null>(
    new Date(new Date().setMonth(new Date().getMonth() - 1))
  ); // Default: last 1 month
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [users, setUsers] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Fetch data based on report type
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          alert("Authentication token not found. Please log in again.");
          return;
        }

        if (reportType === "users") {
          const response = await axios.get<{ users: User[] }>(
            `${import.meta.env.VITE_API_URL}/users`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setUsers(response.data.users);
        } else if (reportType === "announcements") {
          const response = await axios.get<Announcement[]>(
            `${import.meta.env.VITE_API_URL}/announcements`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setAnnouncements(response.data);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        alert("Failed to fetch data for the report.");
      }
    };

    if (reportType) {
      fetchData();
    }
  }, [reportType]);

  // Filter data by date range with type safety
  const filterUsersByDateRange = (data: User[]) => {
    if (!startDate || !endDate) return data;
    return data.filter((user) => {
      const userDate = new Date(user.created_at);
      return userDate >= startDate && userDate <= endDate;
    });
  };

  const filterAnnouncementsByDateRange = (data: Announcement[]) => {
    if (!startDate || !endDate) return data;
    return data.filter((announcement) => {
      const announcementDate = new Date(announcement.sent_at);
      return announcementDate >= startDate && announcementDate <= endDate;
    });
  };

  // Prepare user registration trends data
  const getUserRegistrationData = () => {
    const filteredUsers = filterUsersByDateRange(users);
    const monthlyData: {
      [key: string]: { students: number; lecturers: number };
    } = {};

    filteredUsers.forEach((user) => {
      const date = new Date(user.created_at);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`; // e.g., "2024-1"
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { students: 0, lecturers: 0 };
      }
      if (user.role === "student") {
        monthlyData[monthKey].students += 1;
      } else if (user.role === "lecturer") {
        monthlyData[monthKey].lecturers += 1;
      }
    });

    const labels = Object.keys(monthlyData).sort();
    const studentData = labels.map((label) => monthlyData[label].students);
    const lecturerData = labels.map((label) => monthlyData[label].lecturers);

    return {
      tableData: filteredUsers,
      chartData: {
        labels,
        datasets: [
          {
            label: "Students",
            data: studentData,
            borderColor: "rgb(255, 99, 132)",
            backgroundColor: "rgba(255, 99, 132, 0.5)",
          },
          {
            label: "Lecturers",
            data: lecturerData,
            borderColor: "rgb(53, 162, 235)",
            backgroundColor: "rgba(53, 162, 235, 0.5)",
          },
        ],
      },
    };
  };

  // Prepare announcement activity data
  const getAnnouncementActivityData = () => {
    const filteredAnnouncements = filterAnnouncementsByDateRange(announcements);
    const senderData: { [key: string]: number } = {};

    filteredAnnouncements.forEach((announcement) => {
      const sender = announcement.sender_name || "Unknown";
      senderData[sender] = (senderData[sender] || 0) + 1;
    });

    const labels = Object.keys(senderData);
    const data = Object.values(senderData);

    return {
      tableData: filteredAnnouncements,
      chartData: {
        labels,
        datasets: [
          {
            label: "Announcements",
            data,
            backgroundColor: labels.map(
              () =>
                `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${
                  Math.random() * 255
                }, 0.5)`
            ),
          },
        ],
      },
    };
  };

  // Generate PDF report
  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text("Smart Campus Report", 20, 20);
    doc.text(
      `Report Type: ${
        reportType === "users"
          ? "User Registration Trends"
          : "Announcement Activity"
      }`,
      20,
      30
    );
    doc.text(
      `Date Range: ${startDate?.toLocaleDateString() || "N/A"} - ${
        endDate?.toLocaleDateString() || "N/A"
      }`,
      20,
      40
    );

    if (reportType === "users") {
      const data = getUserRegistrationData();
      autoTable(doc, {
        head: [["Name", "Role", "Registered At"]],
        body: data.tableData.map((user) => [
          user.name,
          user.role,
          user.created_at
            ? new Date(user.created_at).toLocaleDateString()
            : "N/A",
        ]),
        startY: 50,
      });
    } else if (reportType === "announcements") {
      const data = getAnnouncementActivityData();
      autoTable(doc, {
        head: [["Message", "Sender", "Sent At"]],
        body: data.tableData.map((announcement) => [
          announcement.message,
          announcement.sender_name || "Unknown",
          announcement.sent_at
            ? new Date(announcement.sent_at).toLocaleDateString()
            : "N/A",
        ]),
        startY: 50,
      });
    }

    doc.save("report.pdf");
  };

  // Render chart and table based on report type
  const renderReport = () => {
    if (reportType === "users") {
      const { tableData, chartData } = getUserRegistrationData();
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">
              User Registration Trends
            </h3>
            <Line
              data={chartData}
              options={{
                responsive: true,
                plugins: { legend: { position: "top" } },
              }}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">User Details</h3>
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border p-2">Name</th>
                  <th className="border p-2">Role</th>
                  <th className="border p-2">Registered At</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((user) => (
                  <tr key={user.id}>
                    <td className="border p-2">{user.name}</td>
                    <td className="border p-2">{user.role}</td>
                    <td className="border p-2">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    } else if (reportType === "announcements") {
      const { tableData, chartData } = getAnnouncementActivityData();
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">
              Announcement Activity
            </h3>
            <Bar
              data={chartData}
              options={{
                responsive: true,
                plugins: { legend: { position: "top" } },
              }}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Announcement Details</h3>
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border p-2">Message</th>
                  <th className="border p-2">Sender</th>
                  <th className="border p-2">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((announcement) => (
                  <tr key={announcement.id}>
                    <td className="border p-2">{announcement.message}</td>
                    <td className="border p-2">
                      {announcement.sender_name || "Unknown"}
                    </td>
                    <td className="border p-2">
                      {announcement.sent_at
                        ? new Date(announcement.sent_at).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <button
              onClick={() => navigate("/admin-dashboard")}
              className="bg-orange-500 text-white p-2 rounded-full hover:bg-orange-600"
            >
              <FaArrowLeft />
            </button>
            <h1 className="text-3xl font-semibold ml-4">Report Generation</h1>
          </div>
          {reportType && (
            <button
              onClick={downloadPDF}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Download PDF
            </button>
          )}
        </div>

        {/* Report Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Report Type:
          </label>
          <select
            value={reportType || ""}
            onChange={(e) =>
              setReportType(e.target.value as "users" | "announcements" | null)
            }
            className="w-full p-2 border rounded-lg bg-gray-100"
          >
            <option value="" disabled>
              Select a report type
            </option>
            <option value="users">User Registration Trends</option>
            <option value="announcements">Announcement Activity</option>
          </select>
        </div>

        {/* Date Range Selection */}
        {reportType && (
          <div className="mb-6 flex space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date:
              </label>
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                className="p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date:
              </label>
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate ?? undefined} // Fix: Convert null to undefined
                className="p-2 border rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Render Report */}
        {reportType && renderReport()}
      </div>
    </div>
  );
};

export default ReportGenerationPage;
