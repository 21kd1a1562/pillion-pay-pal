-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('rider', 'partner');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create settings table for petrol cost
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  daily_petrol_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(rider_id)
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'requested', 'missed')),
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(partner_id, rider_id, date)
);

-- Create requests table for notifications
CREATE TABLE public.requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'ignored')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(rider_id, partner_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for settings
CREATE POLICY "Riders can manage their own settings"
ON public.settings FOR ALL
USING (auth.uid() = rider_id);

-- RLS Policies for attendance
CREATE POLICY "Users can view their own attendance records"
ON public.attendance FOR SELECT
USING (auth.uid() = partner_id OR auth.uid() = rider_id);

CREATE POLICY "Partners can insert their own attendance"
ON public.attendance FOR INSERT
WITH CHECK (auth.uid() = partner_id);

CREATE POLICY "Partners can update their own attendance"
ON public.attendance FOR UPDATE
USING (auth.uid() = partner_id);

-- RLS Policies for requests
CREATE POLICY "Users can view their own requests"
ON public.requests FOR SELECT
USING (auth.uid() = rider_id OR auth.uid() = partner_id);

CREATE POLICY "Riders can create requests"
ON public.requests FOR INSERT
WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Both users can update request status"
ON public.requests FOR UPDATE
USING (auth.uid() = rider_id OR auth.uid() = partner_id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'partner')::user_role
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();