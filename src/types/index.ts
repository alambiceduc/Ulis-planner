export type EventType = 'ULIS' | 'CLASSE' | 'PRISE_EN_CHARGE' | 'VIE_SCOLAIRE';
export type PeriodName = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
export type ViewType = 'periods' | 'students' | 'timetable' | 'shared';
export type SharedTimetableView = 'ulis' | 'aesh' | 'prises_en_charge';

export interface Database {
  public: {
    Tables: {
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          start_time: string;
          end_time: string;
          time_step: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_time?: string;
          end_time?: string;
          time_step?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          start_time?: string;
          end_time?: string;
          time_step?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      periods: {
        Row: {
          id: string;
          user_id: string;
          name: PeriodName;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: PeriodName;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: PeriodName;
          created_at?: string;
        };
      };
      students: {
        Row: {
          id: string;
          user_id: string;
          period_id: string;
          first_name: string;
          last_name: string;
          reference_timetable_pdf_url: string | null;
          include_vie_scolaire_in_percentages: boolean;
          overlay_period_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          period_id: string;
          first_name: string;
          last_name?: string;
          reference_timetable_pdf_url?: string | null;
          include_vie_scolaire_in_percentages?: boolean;
          overlay_period_profile_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          period_id?: string;
          first_name?: string;
          last_name?: string;
          reference_timetable_pdf_url?: string | null;
          include_vie_scolaire_in_percentages?: boolean;
          overlay_period_profile_id?: string | null;
          created_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          student_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          type: EventType;
          aesh: boolean;
          label: string;
          location: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          type: EventType;
          aesh?: boolean;
          label?: string;
          location?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          type?: EventType;
          aesh?: boolean;
          label?: string;
          location?: string;
          created_at?: string;
        };
      };
      overlay_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
        };
      };
      overlay_template_items: {
        Row: {
          id: string;
          user_id: string;
          template_id: string;
          name: string;
          days: number[];
          start_time: string;
          end_time: string;
          color: string;
          is_enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_id: string;
          name: string;
          days: number[];
          start_time: string;
          end_time: string;
          color?: string;
          is_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          template_id?: string;
          name?: string;
          days?: number[];
          start_time?: string;
          end_time?: string;
          color?: string;
          is_enabled?: boolean;
          created_at?: string;
        };
      };
      overlay_period_profiles: {
        Row: {
          id: string;
          user_id: string;
          period_id: string;
          name: string;
          source_template_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          period_id: string;
          name: string;
          source_template_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          period_id?: string;
          name?: string;
          source_template_id?: string | null;
          created_at?: string;
        };
      };
      overlay_period_items: {
        Row: {
          id: string;
          user_id: string;
          period_profile_id: string;
          name: string;
          days: number[];
          start_time: string;
          end_time: string;
          color: string;
          is_enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          period_profile_id: string;
          name: string;
          days: number[];
          start_time: string;
          end_time: string;
          color?: string;
          is_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          period_profile_id?: string;
          name?: string;
          days?: number[];
          start_time?: string;
          end_time?: string;
          color?: string;
          is_enabled?: boolean;
          created_at?: string;
        };
      };
    };
  };
}

export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
export type Period = Database['public']['Tables']['periods']['Row'];
export type Student = Database['public']['Tables']['students']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];
export type OverlayTemplate = Database['public']['Tables']['overlay_templates']['Row'];
export type OverlayTemplateItem = Database['public']['Tables']['overlay_template_items']['Row'];
export type OverlayPeriodProfile = Database['public']['Tables']['overlay_period_profiles']['Row'];
export type OverlayPeriodItem = Database['public']['Tables']['overlay_period_items']['Row'];

export interface StudentEvent extends Event {
  student: Student;
}
