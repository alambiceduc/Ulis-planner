import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './components/Auth';
import { PeriodSelector } from './components/PeriodSelector';
import { StudentList } from './components/StudentList';
import { TimetableGrid } from './components/TimetableGrid';
import { SharedTimetables } from './components/SharedTimetables';
import { PrintView } from './components/PrintView';
import type { Period, Student } from './lib/database.types';

type View = 'periods' | 'students' | 'timetable' | 'shared';

function AppContent() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>('periods');
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const handleNavigateHome = () => {
    setView('periods');
    setSelectedPeriod(null);
    setSelectedStudent(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-gray-600">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (view === 'timetable' && selectedStudent) {
    return (
      <TimetableGrid
        student={selectedStudent}
        onBack={() => {
          setView('students');
          setSelectedStudent(null);
        }}
        onNavigateHome={handleNavigateHome}
      />
    );
  }

  if (view === 'shared' && selectedPeriod) {
    return (
      <SharedTimetables
        period={selectedPeriod}
        onBack={() => {
          setView('students');
        }}
        onNavigateHome={handleNavigateHome}
      />
    );
  }

  if (view === 'students' && selectedPeriod) {
    return (
      <StudentList
        period={selectedPeriod}
        onBack={() => {
          setView('periods');
          setSelectedPeriod(null);
        }}
        onSelectStudent={(student) => {
          setSelectedStudent(student);
          setView('timetable');
        }}
        onViewSharedTimetables={() => {
          setView('shared');
        }}
        onNavigateHome={handleNavigateHome}
      />
    );
  }

  return (
    <PeriodSelector
      onSelectPeriod={(period) => {
        setSelectedPeriod(period);
        setView('students');
      }}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/print" element={<PrintView />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
