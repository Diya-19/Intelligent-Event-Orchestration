import React, { useState, useEffect, useRef } from "react";
import { Plane, Building, Wallet, AlertCircle, Loader2, FileText, Calendar, Check, Clock, CheckCircle2, Download, MapPin, Bell, PhoneCall, ListTodo, UploadCloud, DollarSign, Receipt, X } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import TravelTabs from "./TravelTabs";

interface ClaimData {
  status: string;
  claim_amount: number;
  submitted_at: string | null;
  bank_name: string;
  branch_name: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  phone_number: string;
  receipts: any[];
}

interface TravelData {
  budget: number;
  accommodation: any;
  hotel_name?: string;
  hotel_address?: string;
  hotel_contact?: string;
  hotel_checkin?: string;
  hotel_google_maps_url?: string;
  combined_ticket_url: string | null;
  combined_ticket_name: string | null;
  combined_ticket_uploaded_at: string | null;
  is_locked: boolean;
  travel_locked?: boolean;
  reimbursement_limit?: number;
  ticket_file_url?: string | null;
  travel_details?: any;
  travel_preferences?: any;
  participant_notes: string | null;
  claim: ClaimData | null;
  timeline: any;
  travel_schedule: any;
}

interface ParticipantData {
  participant: { name: string };
  event: { name: string };
}

export default function TravelDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [travelData, setTravelData] = useState<TravelData | null>(null);
  const [participantData, setParticipantData] = useState<ParticipantData | null>(null);

  // Mock Travel Details State
  const [travelDetailsForm, setTravelDetailsForm] = useState({
    arrivalDate: "",
    arrivalTime: "",
    arrivalStation: "",
    departureDate: "",
    departureTime: "",
    departureStation: "",
    flightNumber: "",
    pnr: "",
    needAirportToHotelCab: false,
    needHotelToAirportCab: false,
    needAccommodation: false,
    selfArrangedAccommodation: false
  });
  const travelDetailsLocked = travelData?.travel_locked || false;

  const [travelDetailsTouched, setTravelDetailsTouched] = useState<Record<string, boolean>>({});
  const handleTravelTouch = (field: string) => setTravelDetailsTouched(prev => ({...prev, [field]: true}));

  const travelDetailsErrors = React.useMemo(() => {
    const errors: Record<string, string> = {};
    const f = travelDetailsForm;

    if (!f.arrivalDate) errors.arrivalDate = "Arrival Date is required.";
    if (!f.arrivalTime) errors.arrivalTime = "Arrival Time is required.";
    if (!f.arrivalStation.trim()) errors.arrivalStation = "Arrival Airport / Station is required.";

    if (!f.departureDate) errors.departureDate = "Departure Date is required.";
    if (!f.departureTime) errors.departureTime = "Departure Time is required.";
    if (!f.departureStation.trim()) errors.departureStation = "Departure Airport / Station is required.";

    if (!f.flightNumber.trim()) errors.flightNumber = "Flight / Train Number is required.";
    if (!f.pnr.trim()) {
      errors.pnr = "PNR Number is required.";
    } else if (f.pnr.trim().length < 6) {
      errors.pnr = "PNR must be at least 6 characters.";
    }

    if (f.arrivalDate && f.departureDate) {
      if (f.departureDate < f.arrivalDate) {
        errors.departureDate = "Cannot be before arrival.";
      } else if (f.departureDate === f.arrivalDate && f.arrivalTime && f.departureTime) {
        if (f.departureTime <= f.arrivalTime) {
          errors.departureTime = "Must be later than arrival.";
        }
      }
    }

    return errors;
  }, [travelDetailsForm]);
  const isTravelDetailsValid = Object.keys(travelDetailsErrors).length === 0;

  // Modals & Inputs
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const combinedTicketInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // Claim Form State
  const [claimForm, setClaimForm] = useState({
    account_holder_name: "",
    phone_number: "",
    account_number: "",
    confirm_account_number: "",
    ifsc_code: "",
    arrival_expense: "",
    return_expense: "",
    other_expense: ""
  });
  const [claimFormError, setClaimFormError] = useState("");
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [bankPreview, setBankPreview] = useState<{bank_name: string, branch_name: string} | null>(null);
  const [ifscError, setIfscError] = useState(false);
  const [ifscLoading, setIfscLoading] = useState(false);

  const totalClaimAmount = (parseFloat(claimForm.arrival_expense) || 0) + (parseFloat(claimForm.return_expense) || 0) + (parseFloat(claimForm.other_expense) || 0);
  const reimbursementLimit = travelData?.reimbursement_limit ?? 35000;
  const ifscValid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(claimForm.ifsc_code) && bankPreview !== null;
  const accountsMatch = claimForm.account_number === claimForm.confirm_account_number && claimForm.account_number.length > 0;

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [travelRes, dashRes] = await Promise.all([
        api.get("/api/participant/travel"),
        api.get("/api/participant/dashboard")
      ]);
      setTravelData(travelRes.data);
      setParticipantData(dashRes.data);

      if (travelRes.data?.travel_details) {
        setTravelDetailsForm({
          arrivalDate: travelRes.data.travel_details.arrival_date || "",
          arrivalTime: travelRes.data.travel_details.arrival_time || "",
          arrivalStation: travelRes.data.travel_details.arrival_airport_or_station || "",
          departureDate: travelRes.data.travel_details.departure_date || "",
          departureTime: travelRes.data.travel_details.departure_time || "",
          departureStation: travelRes.data.travel_details.departure_airport_or_station || "",
          flightNumber: travelRes.data.travel_details.flight_or_train_number || "",
          pnr: travelRes.data.travel_details.pnr_number || "",
          needAirportToHotelCab: travelRes.data.travel_preferences?.need_airport_to_hotel_cab || false,
          needHotelToAirportCab: travelRes.data.travel_preferences?.need_hotel_to_airport_cab || false,
          needAccommodation: travelRes.data.travel_preferences?.need_accommodation || false,
          selfArrangedAccommodation: travelRes.data.travel_preferences?.self_arranged_accommodation || false
        });
      }
    } catch (err: any) {
      setError("Failed to load travel dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleTicketUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.type !== "application/pdf") {
      alert("Only PDF files are allowed for tickets.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.post(`/api/participant/travel/ticket/combined`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      fetchDashboard();
    } catch (err) {
      alert("Failed to upload ticket");
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.post("/api/participant/travel/claim/receipt", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      alert("Receipt uploaded successfully!");
      fetchDashboard();
    } catch (err) {
      alert("Failed to upload receipt. Make sure it's a PDF, PNG, or JPG.");
    }
  };

  const handleIfscChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setClaimForm({...claimForm, ifsc_code: val});
    setIfscError(false);

    if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(val)) {
      setIfscLoading(true);
      try {
        const res = await api.get(`/api/participant/travel/ifsc/${val}`);
        setBankPreview({ bank_name: res.data.bank, branch_name: res.data.branch });
      } catch (err) {
        setBankPreview(null);
        setIfscError(true);
      } finally {
        setIfscLoading(false);
      }
    } else {
      setBankPreview(null);
    }
  };

  const submitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimFormError("");

    if (!accountsMatch) {
      setClaimFormError("Account numbers do not match.");
      return;
    }
    if (!ifscValid) {
      setClaimFormError("Invalid IFSC Code.");
      return;
    }
    if (totalClaimAmount > reimbursementLimit) {
      setClaimFormError("Your claim exceeds the maximum reimbursement amount approved for this event.");
      return;
    }
    if (totalClaimAmount <= 0) {
      setClaimFormError("Total claim amount must be greater than 0.");
      return;
    }
    if (!travelData?.combined_ticket_url) {
      setClaimFormError("Travel Ticket PDF is missing.");
      return;
    }

    try {
      setClaimSubmitting(true);
      await api.post("/api/participant/travel/claim", {
        account_holder_name: claimForm.account_holder_name,
        phone_number: claimForm.phone_number,
        account_number: claimForm.account_number,
        ifsc_code: claimForm.ifsc_code,
        claim_amount: totalClaimAmount,
        arrival_expense: parseFloat(claimForm.arrival_expense) || 0,
        return_expense: parseFloat(claimForm.return_expense) || 0,
        other_expense: parseFloat(claimForm.other_expense) || 0
      });
      setIsClaimModalOpen(false);
      fetchDashboard();
    } catch (err) {
      setClaimFormError("Failed to submit claim.");
    } finally {
      setClaimSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-4" />
        <p className="text-gray-500">Loading travel details...</p>
      </div>
    );
  }

  if (error || !travelData) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Oops!</h2>
        <p className="text-gray-600 mt-2">{error || "Could not load travel details."}</p>
      </div>
    );
  }

  const { budget, participant_notes, travel_schedule, hotel_name, hotel_address, hotel_contact, hotel_checkin, hotel_google_maps_url, ticket_file_url, claim } = travelData;
  const participantName = participantData?.participant?.name || "Participant";
  const eventName = participantData?.event?.name || "Event";

  const maxBudget = budget;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "TBD";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const scheduleItems = [
    { label: 'Arrival & Check-in', date: formatDate(travel_schedule?.arrival_date) },
    { label: 'Hackathon Day 1', date: formatDate(travel_schedule?.hackathon_day_1) },
    { label: 'Hackathon Day 2', date: formatDate(travel_schedule?.hackathon_day_2) },
    { label: 'Winner Announcement', date: formatDate(travel_schedule?.winner_announcement) },
    { label: 'Departure', date: formatDate(travel_schedule?.departure_date) }
  ];

  const travelTimelineItems = [
    { label: 'Round 3 Qualified', isCompleted: true },
    { label: 'Travel Details Released', isCompleted: true },
    { label: 'Ticket Released', isCompleted: ticket_file_url !== null },
    { label: 'Accommodation Assigned', isCompleted: !!hotel_name },
    { label: 'Check-in Pending', isCompleted: false },
    { label: 'Event Day', isCompleted: false }
  ];

  const displayReimbursementStatus = claim?.status
    ? claim.status.replace("_", " ").replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())))
    : "Draft";

  return (
    <div className="space-y-6 p-8">
      <TravelTabs />
      <h1 className="text-2xl font-bold text-gray-900">Travel Dashboard</h1>

      {/* Hidden file inputs */}
      <input type="file" accept=".pdf" ref={combinedTicketInputRef} className="hidden" onChange={handleTicketUpload} />
      <input type="file" accept=".pdf,.png,.jpg,.jpeg" ref={receiptInputRef} className="hidden" onChange={handleReceiptUpload} />

      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-200 flex flex-col lg:flex-row gap-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-6 flex-1">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-purple-50 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Plane className="text-purple-600" size={48} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Hello, {participantName}!</h2>
            <p className="text-gray-600 mt-1">We're here to make your trip smooth and stress-free.</p>
            <h3 className="text-lg font-bold text-purple-700 mt-3">{eventName}</h3>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                <CheckCircle2 size={14} /> Reimbursement Eligible
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <Wallet size={14} /> {maxBudget ? `Budget: ₹${maxBudget.toLocaleString('en-IN')}` : "Budget not announced yet"}
              </span>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="lg:w-1/3 bg-gray-50 rounded-xl p-5 border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="text-purple-600" size={18} />
            <h3 className="font-semibold text-gray-900 text-sm">Important Notes</h3>
          </div>
          {participant_notes ? (
            <div className="space-y-2">
              {participant_notes.split('\n').filter(n => n.trim() !== '').map((note, i) => (
                <p key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">•</span>
                  <span>{note}</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No instructions from organizers yet.</p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Row 1: Main Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col h-full">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-50">
                <FileText className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500">Travel Documents</p>
                <p className="text-base font-bold text-gray-900 leading-tight">
                  Ticket: {travelData?.combined_ticket_url ? "Uploaded" : "Pending"}
                </p>
              </div>
            </div>

            <div className="mb-4">
              {travelData?.is_locked ? (
                 <p className="text-sm text-gray-600 leading-relaxed">Your ticket is currently under review by the committee.</p>
              ) : (
                 <p className="text-sm text-gray-600 leading-relaxed">Upload a single PDF containing both arrival and return tickets.</p>
              )}
            </div>

            <div className="mt-auto flex gap-2">
              {travelData?.is_locked ? (
                 <div className="w-full text-center py-2 px-4 rounded-xl bg-red-50 text-red-700 font-semibold text-sm border border-red-100">
                    Claim Under Review. Editing Disabled.
                 </div>
              ) : (
                 <>
                   {travelData?.combined_ticket_url && (
                     <a href={travelData.combined_ticket_url} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-white text-blue-600 text-sm font-semibold rounded-xl border border-gray-200 text-center hover:bg-gray-50 transition">
                       View
                     </a>
                   )}
                   <button onClick={() => combinedTicketInputRef.current?.click()} className={`flex-1 py-2 text-sm font-semibold rounded-xl transition ${travelData?.combined_ticket_url ? 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' : 'w-full bg-purple-50 text-purple-700 border border-purple-100 hover:bg-purple-100 flex items-center justify-center gap-2'}`}>
                     {!travelData?.combined_ticket_url && <UploadCloud size={16} />}
                     {travelData?.combined_ticket_url ? "Replace" : "Upload Ticket"}
                   </button>
                 </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col h-full">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50">
                <Receipt className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500">Reimbursement</p>
                <p className="text-base font-bold text-gray-900 leading-tight">
                  Status: {displayReimbursementStatus}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                {claim?.status && claim?.status !== "DRAFT"
                  ? (
                    <>
                      <span className="font-semibold text-gray-900 block mt-1">Amount Claimed: ₹{claim.claim_amount}</span>
                      <span className="font-semibold text-gray-900 block mt-0.5">Submitted On: {formatDate(claim.submitted_at || undefined)}</span>
                      <span className="font-semibold text-gray-900 block mt-0.5">Last Updated: {formatDate(claim.submitted_at || undefined)}</span>
                    </>
                  )
                  : "Submit your claim and receipts to get started."}
              </p>
            </div>

            <div className="mt-auto space-y-2">
              {travelData?.is_locked ? (
                 <div className="text-center py-2 px-4 rounded-xl bg-red-50 text-red-700 font-semibold text-sm border border-red-100">
                    Claim Under Review. Editing Disabled.
                 </div>
              ) : claim?.status && claim?.status !== "DRAFT" ? (
                 <button onClick={() => {
                   setClaimForm({
                     account_holder_name: claim.account_holder_name || "",
                     phone_number: claim.phone_number || "",
                     account_number: claim.account_number || "",
                     confirm_account_number: claim.account_number || "",
                     ifsc_code: claim.ifsc_code || "",
                     arrival_expense: (claim as any).arrival_expense?.toString() || "",
                     return_expense: (claim as any).return_expense?.toString() || "",
                     other_expense: (claim as any).other_expense?.toString() || ""
                   });
                   if (claim.ifsc_code) {
                     setBankPreview({ bank_name: claim.bank_name || "", branch_name: claim.branch_name || "" });
                   }
                   setIsClaimModalOpen(true);
                 }} className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-purple-50 text-purple-700 border border-purple-100 text-sm font-semibold rounded-xl hover:bg-purple-100 transition">
                   <FileText size={16} /> Edit Claim
                 </button>
              ) : null}
              {(!claim?.status || claim?.status === "DRAFT") && !travelData?.is_locked && (
                 <button onClick={() => setIsClaimModalOpen(true)} className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition">
                   <FileText size={16} /> Submit Claim
                 </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col h-full">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Building className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500">Accommodation</p>
                {hotel_name ? (
                  <a href={hotel_google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel_name)}`} target="_blank" rel="noreferrer" className="text-base font-bold text-blue-600 hover:text-blue-700 hover:underline leading-tight block">
                    {hotel_name}
                  </a>
                ) : (
                  <p className="text-base font-bold text-gray-900 leading-tight">Accommodation not assigned yet.</p>
                )}
              </div>
            </div>
            {hotel_name && (
              <div className="mb-4 space-y-2 mt-2">
                {hotel_checkin && (
                  <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Check-in:</span> {hotel_checkin}</p>
                )}
                {hotel_address && (
                  <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Address:</span> {hotel_address}</p>
                )}
                {hotel_contact && (
                  <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Contact:</span> {hotel_contact}</p>
                )}
              </div>
            )}
            <div className="mt-auto">
              {hotel_google_maps_url ? (
                <a href={hotel_google_maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-50 text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-100 transition">
                  <MapPin size={16} /> Open Hotel Location
                </a>
              ) : (
                <button disabled className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-50 text-gray-400 border border-gray-200 text-sm font-semibold rounded-xl cursor-not-allowed">
                  <MapPin size={16} /> Location Unavailable
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Secondary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col h-full">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <Plane className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Travel Details</p>
                <p className="text-xs text-gray-500">Your planned journey</p>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!isTravelDetailsValid) {
                  const allTouched = Object.keys(travelDetailsForm).reduce((acc, key) => ({...acc, [key]: true}), {});
                  setTravelDetailsTouched(allTouched);
                  return;
                }
                try {
                  await api.patch("/api/participant/travel/details", {
                    arrival_date: travelDetailsForm.arrivalDate,
                    arrival_time: travelDetailsForm.arrivalTime,
                    arrival_airport_or_station: travelDetailsForm.arrivalStation,
                    departure_date: travelDetailsForm.departureDate,
                    departure_time: travelDetailsForm.departureTime,
                    departure_airport_or_station: travelDetailsForm.departureStation,
                    flight_or_train_number: travelDetailsForm.flightNumber,
                    pnr_number: travelDetailsForm.pnr,
                    need_airport_to_hotel_cab: travelDetailsForm.needAirportToHotelCab,
                    need_hotel_to_airport_cab: travelDetailsForm.needHotelToAirportCab,
                    need_accommodation: travelDetailsForm.needAccommodation,
                    self_arranged_accommodation: travelDetailsForm.selfArrangedAccommodation,
                    emergency_contact_name: "",
                    emergency_contact_phone: ""
                  });
                  await fetchDashboard();
                } catch (err) {
                  console.error(err);
                }
              }}
              className="space-y-4 flex-1 flex flex-col"
            >
              {travelDetailsLocked && (
                <div className="p-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-medium flex items-center justify-center gap-2 border border-gray-100">
                  Travel details locked by organizers.
                </div>
              )}

              <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                <div>
                  <p className="text-[10px] font-semibold text-purple-600 mb-1 uppercase tracking-wider">Arrival Information</p>
                  <div className="bg-gray-50 rounded-xl p-2 border border-gray-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input onBlur={() => handleTravelTouch('arrivalDate')} disabled={travelDetailsLocked} onClick={(e) => { try { (e.target as any).showPicker(); } catch(err) {} }} type="date" placeholder="Date" value={travelDetailsForm.arrivalDate} onChange={e => setTravelDetailsForm({...travelDetailsForm, arrivalDate: e.target.value})} className={`w-full p-1.5 rounded-lg border focus:ring-1 outline-none transition text-xs disabled:bg-gray-100 disabled:text-gray-500 cursor-pointer ${travelDetailsTouched.arrivalDate && travelDetailsErrors.arrivalDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'}`} />
                        {travelDetailsTouched.arrivalDate && travelDetailsErrors.arrivalDate && <p className="text-[9px] text-red-500 mt-0.5 leading-tight">{travelDetailsErrors.arrivalDate}</p>}
                      </div>
                      <div>
                        <input onBlur={() => handleTravelTouch('arrivalTime')} disabled={travelDetailsLocked} onClick={(e) => { try { (e.target as any).showPicker(); } catch(err) {} }} type="time" placeholder="Time" value={travelDetailsForm.arrivalTime} onChange={e => setTravelDetailsForm({...travelDetailsForm, arrivalTime: e.target.value})} className={`w-full p-1.5 rounded-lg border focus:ring-1 outline-none transition text-xs disabled:bg-gray-100 disabled:text-gray-500 cursor-pointer ${travelDetailsTouched.arrivalTime && travelDetailsErrors.arrivalTime ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'}`} />
                        {travelDetailsTouched.arrivalTime && travelDetailsErrors.arrivalTime && <p className="text-[9px] text-red-500 mt-0.5 leading-tight">{travelDetailsErrors.arrivalTime}</p>}
                      </div>
                    </div>
                    <div>
                      <input onBlur={() => handleTravelTouch('arrivalStation')} disabled={travelDetailsLocked} type="text" placeholder="Arrival Airport / Station" value={travelDetailsForm.arrivalStation} onChange={e => setTravelDetailsForm({...travelDetailsForm, arrivalStation: e.target.value})} className={`w-full p-1.5 rounded-lg border focus:ring-1 outline-none transition text-xs disabled:bg-gray-100 disabled:text-gray-500 ${travelDetailsTouched.arrivalStation && travelDetailsErrors.arrivalStation ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'}`} />
                      {travelDetailsTouched.arrivalStation && travelDetailsErrors.arrivalStation && <p className="text-[9px] text-red-500 mt-0.5 leading-tight">{travelDetailsErrors.arrivalStation}</p>}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-purple-600 mb-1 uppercase tracking-wider">Departure Information</p>
                  <div className="bg-gray-50 rounded-xl p-2 border border-gray-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input onBlur={() => handleTravelTouch('departureDate')} disabled={travelDetailsLocked} onClick={(e) => { try { (e.target as any).showPicker(); } catch(err) {} }} type="date" placeholder="Date" value={travelDetailsForm.departureDate} onChange={e => setTravelDetailsForm({...travelDetailsForm, departureDate: e.target.value})} className={`w-full p-1.5 rounded-lg border focus:ring-1 outline-none transition text-xs disabled:bg-gray-100 disabled:text-gray-500 cursor-pointer ${travelDetailsTouched.departureDate && travelDetailsErrors.departureDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'}`} />
                        {travelDetailsTouched.departureDate && travelDetailsErrors.departureDate && <p className="text-[9px] text-red-500 mt-0.5 leading-tight">{travelDetailsErrors.departureDate}</p>}
                      </div>
                      <div>
                        <input onBlur={() => handleTravelTouch('departureTime')} disabled={travelDetailsLocked} onClick={(e) => { try { (e.target as any).showPicker(); } catch(err) {} }} type="time" placeholder="Time" value={travelDetailsForm.departureTime} onChange={e => setTravelDetailsForm({...travelDetailsForm, departureTime: e.target.value})} className={`w-full p-1.5 rounded-lg border focus:ring-1 outline-none transition text-xs disabled:bg-gray-100 disabled:text-gray-500 cursor-pointer ${travelDetailsTouched.departureTime && travelDetailsErrors.departureTime ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'}`} />
                        {travelDetailsTouched.departureTime && travelDetailsErrors.departureTime && <p className="text-[9px] text-red-500 mt-0.5 leading-tight">{travelDetailsErrors.departureTime}</p>}
                      </div>
                    </div>
                    <div>
                      <input onBlur={() => handleTravelTouch('departureStation')} disabled={travelDetailsLocked} type="text" placeholder="Departure Airport / Station" value={travelDetailsForm.departureStation} onChange={e => setTravelDetailsForm({...travelDetailsForm, departureStation: e.target.value})} className={`w-full p-1.5 rounded-lg border focus:ring-1 outline-none transition text-xs disabled:bg-gray-100 disabled:text-gray-500 ${travelDetailsTouched.departureStation && travelDetailsErrors.departureStation ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'}`} />
                      {travelDetailsTouched.departureStation && travelDetailsErrors.departureStation && <p className="text-[9px] text-red-500 mt-0.5 leading-tight">{travelDetailsErrors.departureStation}</p>}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-purple-600 mb-1 uppercase tracking-wider">Travel Details</p>
                  <div className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input onBlur={() => handleTravelTouch('flightNumber')} disabled={travelDetailsLocked} type="text" placeholder="Flight / Train No." value={travelDetailsForm.flightNumber} onChange={e => setTravelDetailsForm({...travelDetailsForm, flightNumber: e.target.value})} className={`w-full p-1.5 rounded-lg border focus:ring-1 outline-none transition text-xs disabled:bg-gray-100 disabled:text-gray-500 ${travelDetailsTouched.flightNumber && travelDetailsErrors.flightNumber ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'}`} />
                        {travelDetailsTouched.flightNumber && travelDetailsErrors.flightNumber && <p className="text-[9px] text-red-500 mt-0.5 leading-tight">{travelDetailsErrors.flightNumber}</p>}
                      </div>
                      <div>
                        <input onBlur={() => handleTravelTouch('pnr')} disabled={travelDetailsLocked} type="text" placeholder="PNR" value={travelDetailsForm.pnr} onChange={e => setTravelDetailsForm({...travelDetailsForm, pnr: e.target.value})} className={`w-full p-1.5 rounded-lg border focus:ring-1 outline-none transition text-xs uppercase disabled:bg-gray-100 disabled:text-gray-500 ${travelDetailsTouched.pnr && travelDetailsErrors.pnr ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'}`} />
                        {travelDetailsTouched.pnr && travelDetailsErrors.pnr && <p className="text-[9px] text-red-500 mt-0.5 leading-tight">{travelDetailsErrors.pnr}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-3 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={travelDetailsLocked || !isTravelDetailsValid}
                  className="w-full py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 text-sm font-semibold rounded-xl transition border border-purple-100 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Travel Details
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col h-full">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <ListTodo className="text-orange-600" size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Event Schedule</p>
                <p className="text-xs text-gray-500">Agenda</p>
              </div>
            </div>

            <div className="relative border-l-2 border-orange-100 ml-4 space-y-5 mt-1 flex-1">
              {scheduleItems.map((item, i) => (
                <div key={i} className="relative pl-6">
                  <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center ring-4 ring-white">
                    <Clock className="text-orange-600" size={12} />
                  </div>
                  <div className="leading-tight">
                     <p className="text-xs font-bold text-orange-600 mb-0.5">{item.date}</p>
                     <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col h-full">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <MapPin className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Travel Preferences</p>
                <p className="text-xs text-gray-500">Support Requirements</p>
              </div>
            </div>

            <div className="space-y-3 flex-1">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer">
                <input disabled={travelDetailsLocked} type="checkbox" checked={travelDetailsForm.needAirportToHotelCab} onChange={e => setTravelDetailsForm({...travelDetailsForm, needAirportToHotelCab: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50" />
                <span className="text-sm font-medium text-gray-900">Need Airport → Hotel Cab</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer">
                <input disabled={travelDetailsLocked} type="checkbox" checked={travelDetailsForm.needHotelToAirportCab} onChange={e => setTravelDetailsForm({...travelDetailsForm, needHotelToAirportCab: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50" />
                <span className="text-sm font-medium text-gray-900">Need Hotel → Airport Cab</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer">
                <input disabled={travelDetailsLocked} type="checkbox" checked={travelDetailsForm.needAccommodation} onChange={e => setTravelDetailsForm({...travelDetailsForm, needAccommodation: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50" />
                <span className="text-sm font-medium text-gray-900">Need Accommodation</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer">
                <input disabled={travelDetailsLocked} type="checkbox" checked={travelDetailsForm.selfArrangedAccommodation} onChange={e => setTravelDetailsForm({...travelDetailsForm, selfArrangedAccommodation: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50" />
                <span className="text-sm font-medium text-gray-900">Self-arranged Accommodation</span>
              </label>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Travel Coordinator</p>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-500">Name</span>
                  <span className="text-sm font-bold text-gray-900">Travel Team</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-500">Phone</span>
                  <span className="text-sm font-bold text-gray-900">+91 XXXXX XXXXX</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">WhatsApp</span>
                  <span className="text-sm font-bold text-gray-900">+91 XXXXX XXXXX</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Claim Form Modal */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl border border-gray-100">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Submit Reimbursement Claim</h3>
              <button onClick={() => setIsClaimModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitClaim} className="p-5 space-y-3">
              {travelData?.is_locked && (
                <div className="p-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Claim Under Review. Editing Disabled.
                </div>
              )}
              {claimFormError && (
                <div className="p-2 rounded-lg bg-red-50 text-red-600 text-xs font-medium">
                  {claimFormError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account Holder Name</label>
                  <input disabled={travelData?.is_locked} required type="text" value={claimForm.account_holder_name} onChange={e => setClaimForm({...claimForm, account_holder_name: e.target.value})} className="w-full p-2 rounded-lg border focus:ring-1 outline-none transition disabled:bg-gray-50 disabled:text-gray-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                  <input disabled={travelData?.is_locked} required type="text" value={claimForm.phone_number} onChange={e => setClaimForm({...claimForm, phone_number: e.target.value})} className="w-full p-2 rounded-lg border focus:ring-1 outline-none transition disabled:bg-gray-50 disabled:text-gray-500 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account Number</label>
                  <input disabled={travelData?.is_locked} required type={travelData?.is_locked ? "text" : "password"} value={claimForm.account_number} onChange={e => setClaimForm({...claimForm, account_number: e.target.value})} className="w-full p-2 rounded-lg border focus:ring-1 outline-none transition disabled:bg-gray-50 disabled:text-gray-500 text-sm" />
                </div>
                {!travelData?.is_locked ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Account Number</label>
                    <input required type="text" value={claimForm.confirm_account_number} onChange={e => setClaimForm({...claimForm, confirm_account_number: e.target.value})} className={`w-full p-2 rounded-lg border focus:ring-1 outline-none transition text-sm ${claimForm.confirm_account_number && !accountsMatch ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'}`} />
                    {claimForm.confirm_account_number && !accountsMatch && (
                      <p className="text-[10px] text-red-600 font-medium mt-0.5">Account numbers do not match.</p>
                    )}
                  </div>
                ) : (
                  <div></div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">IFSC Code</label>
                  <div className="relative">
                    <input disabled={travelData?.is_locked} required type="text" value={claimForm.ifsc_code} onChange={handleIfscChange} placeholder="e.g., HDFC0001234" className={`w-full p-2 rounded-lg border focus:ring-1 outline-none transition uppercase disabled:bg-gray-50 disabled:text-gray-500 text-sm ${ifscError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500'}`} />
                    {ifscLoading && <Loader2 className="absolute right-2 top-2.5 w-3.5 h-3.5 animate-spin text-gray-400" />}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name</label>
                  <input type="text" readOnly value={bankPreview?.bank_name || ""} className="w-full p-2 rounded-lg border bg-gray-50 border-gray-100 text-sm font-medium outline-none text-gray-700" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Branch Name</label>
                  <input type="text" readOnly value={bankPreview?.branch_name || ""} className="w-full p-2 rounded-lg border bg-gray-50 border-gray-100 text-sm font-medium outline-none text-gray-700" />
                </div>
                <div className="flex items-end pb-1">
                  {ifscError && <p className="text-xs text-red-600 font-medium flex items-center gap-1"><X size={14} /> Invalid IFSC Code</p>}
                  {bankPreview && !ifscLoading && <p className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={14} /> Bank Verified</p>}
                </div>
              </div>

              <hr className="border-gray-100 my-2" />

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Arrival Ticket (₹)</label>
                  <input disabled={travelData?.is_locked} required type="number" min="0" step="0.01" value={claimForm.arrival_expense} onChange={e => setClaimForm({...claimForm, arrival_expense: e.target.value})} className="w-full p-2 rounded-lg border focus:ring-1 outline-none transition disabled:bg-gray-50 disabled:text-gray-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Return Ticket (₹)</label>
                  <input disabled={travelData?.is_locked} required type="number" min="0" step="0.01" value={claimForm.return_expense} onChange={e => setClaimForm({...claimForm, return_expense: e.target.value})} className="w-full p-2 rounded-lg border focus:ring-1 outline-none transition disabled:bg-gray-50 disabled:text-gray-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Other Expense (₹)</label>
                  <input disabled={travelData?.is_locked} required type="number" min="0" step="0.01" value={claimForm.other_expense} onChange={e => setClaimForm({...claimForm, other_expense: e.target.value})} className="w-full p-2 rounded-lg border focus:ring-1 outline-none transition disabled:bg-gray-50 disabled:text-gray-500 text-sm" />
                </div>
              </div>

              <hr className="border-gray-100 my-2" />

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-700">Travel Ticket PDF *</span>
                    {!travelData?.is_locked && (
                      <button type="button" onClick={() => combinedTicketInputRef.current?.click()} className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded border border-gray-200 transition whitespace-nowrap">Choose File</button>
                    )}
                  </div>
                  {travelData?.combined_ticket_url ? (
                    <span className="text-[10px] text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={12}/> Ticket uploaded</span>
                  ) : (
                    <span className="text-[10px] text-red-500 flex items-center gap-1"><X size={12}/> Missing</span>
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-700">Other Expense Proof</span>
                    {!travelData?.is_locked && (
                      <button type="button" onClick={() => receiptInputRef.current?.click()} className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded border border-gray-200 transition whitespace-nowrap">Choose File</button>
                    )}
                  </div>
                  {travelData?.claim?.receipts && travelData.claim.receipts.length > 0 ? (
                    <span className="text-[10px] text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={12}/> {travelData.claim.receipts.length} file(s)</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">Optional</span>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">Maximum Reimbursement Allowed</span>
                  <span className="text-sm font-semibold text-gray-900">₹{reimbursementLimit.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-gray-900">Total Claim Amount</span>
                  <span className="text-lg font-bold text-gray-900">₹{totalClaimAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                  {totalClaimAmount <= reimbursementLimit ? (
                    <>
                      <span className="text-xs font-semibold text-green-600 flex items-center gap-1"><CheckCircle2 size={14} /> Within reimbursement limit</span>
                      <span className="text-xs font-medium text-gray-600">Remaining Eligibility: ₹{(reimbursementLimit - totalClaimAmount).toLocaleString('en-IN')}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-red-600 flex items-center gap-1"><X size={14} /> Exceeds reimbursement limit by ₹{(totalClaimAmount - reimbursementLimit).toLocaleString('en-IN')}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-2 flex gap-3 justify-end">
                <button type="button" onClick={() => setIsClaimModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition border border-transparent">
                  {travelData?.is_locked ? "Close" : "Cancel"}
                </button>
                {!travelData?.is_locked && (
                  <button type="submit" disabled={claimSubmitting || !accountsMatch || !ifscValid || totalClaimAmount > reimbursementLimit || totalClaimAmount <= 0} className="px-5 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {claimSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Submit Claim
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}