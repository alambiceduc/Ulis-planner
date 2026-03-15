import { useState, useEffect, useCallback } from 'react';
import { studentsService } from '../services/students.service';
import type { Student } from '../types';

export function useStudents(periodId: string | null) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStudents = useCallback(async () => {
    if (!periodId) {
      setStudents([]);
      return;
    }

    setLoading(true);
    const data = await studentsService.getByPeriod(periodId);
    setStudents(data);
    setLoading(false);
  }, [periodId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  return { students, loading, reloadStudents: loadStudents };
}

export function useStudent(studentId: string | null) {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStudent = useCallback(async () => {
    if (!studentId) {
      setStudent(null);
      return;
    }

    setLoading(true);
    const data = await studentsService.getById(studentId);
    setStudent(data);
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    loadStudent();
  }, [loadStudent]);

  return { student, loading, reloadStudent: loadStudent };
}
