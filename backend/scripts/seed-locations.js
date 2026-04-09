/* eslint-disable */
// Seed script for normalized location hierarchy
// Run with: node backend/scripts/seed-locations.js
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

const now = new Date();

/**
 * Source data — each row exactly as provided in the dataset.
 * The script will normalize this into 3 collections:
 *   provinces, cities, areas (with subareas[] and blockPhases[])
 */
const rawData = [
  // ─── Islamabad > Islamabad > Gulberg Greens ───────────────────────
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Greens', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Greens', subarea: 'A', blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Greens', subarea: 'A-Executive', blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Greens', subarea: 'B', blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Greens', subarea: 'C', blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Greens', subarea: 'D', blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Greens', subarea: 'E', blockPhase: null },

  // ─── Islamabad > Islamabad > Gulberg Residencia ──────────────────
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block A' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block B' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block C' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block D' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block E' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block F' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block G' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block H' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block J' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block K' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block L' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block M' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block N' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block P' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block Q' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Gulberg Residencia', subarea: null, blockPhase: 'Block R' },

  // ─── Khyber Pakhtunkhwa > Peshawar > Hayatabad ───────────────────
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Phase 1' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Phase 2' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Phase 3' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Phase 4' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Phase 5' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Phase 6' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Phase 7' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Sector A' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Sector B' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Sector C' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Sector D' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Sector E' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Sector F' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Sector G' },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hayatabad', subarea: null, blockPhase: 'Sector H' },

  // ─── Punjab > Hasilpur ────────────────────────────────────────────
  { province: 'Punjab', city: 'Hasilpur', area: null, subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Ahmedpur East', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Bahawalpur', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Bait Bakhtiari', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Basti Babbar', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Basti Dhandlah', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Basti Nari', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Dadwala', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Ganehar', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Khairpur Tamiwali', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Khanqah Sharif', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Khosa', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Kotla Musa Khan', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Mianwala Kariya', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Muhammadgarh', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Najwaniwala', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Qaimpur', subarea: null, blockPhase: null },
  { province: 'Punjab', city: 'Hasilpur', area: 'Yazman', subarea: null, blockPhase: null },

  // ─── Azad Jammu & Kashmir > Bhimbar ───────────────────────────────
  { province: 'Azad Jammu & Kashmir', city: 'Bhimbar', area: null, subarea: null, blockPhase: null },

  // ─── Azad Jammu & Kashmir > Kotli ─────────────────────────────────
  { province: 'Azad Jammu & Kashmir', city: 'Kotli', area: null, subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Kotli', area: 'Daggar Kotli', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Kotli', area: 'Kotli (A.K.)', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Kotli', area: 'Kotli Bala', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Kotli', area: 'Kotli Baqir Shah', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Kotli', area: 'Kotli Pain', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Kotli', area: 'Ratta', subarea: null, blockPhase: null },

  // ─── Azad Jammu & Kashmir > Mangla ────────────────────────────────
  { province: 'Azad Jammu & Kashmir', city: 'Mangla', area: null, subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Mangla', area: 'Mad Mangla', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Mangla', area: 'Mangla Dam', subarea: null, blockPhase: null },

  // ─── Azad Jammu & Kashmir > Muzaffarabad ──────────────────────────
  { province: 'Azad Jammu & Kashmir', city: 'Muzaffarabad', area: null, subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Muzaffarabad', area: 'Awan Patti', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Muzaffarabad', area: 'Garhi Dupatta', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Muzaffarabad', area: 'Ghori', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Muzaffarabad', area: 'Hattian Dupatta', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Muzaffarabad', area: 'Kayian', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Muzaffarabad', area: 'Khatpura', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Muzaffarabad', area: 'Kumar Bandi', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Muzaffarabad', area: 'Punjkot', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Muzaffarabad', area: 'Ratakha', subarea: null, blockPhase: null },
  { province: 'Azad Jammu & Kashmir', city: 'Muzaffarabad', area: 'Thehrian', subarea: null, blockPhase: null },

  // ─── Azad Jammu & Kashmir > Rawalakot ─────────────────────────────
  { province: 'Azad Jammu & Kashmir', city: 'Rawalakot', area: null, subarea: null, blockPhase: null },

  // ─── Balochistan ──────────────────────────────────────────────────
  { province: 'Balochistan', city: 'Bela', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Bhag', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Chaman', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Chaman', area: 'New Abadi Chaman', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Chaman', area: 'Old Chaman', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Dadhar', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Dalbandin', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Dera Bugti', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Dera Bugti', area: 'Sui', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Gadani', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Gwadar', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Harnai', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Jiwani', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Kalat', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Kalat', area: 'Kosh Kalat', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Kalat', area: 'Mashani Kalat', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Kharan', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Khuzdar', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Khuzdar', area: 'Khuzdar Cantt.', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Kohlu', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Loralai', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Mach', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Mastung', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Mastung', area: 'Mastung Road', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Nushki', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Nushki', area: 'Nushki Jadeed', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Ormara', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Pasni', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Pishin', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Aghbarg', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Air Port Quetta', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Gulzar', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Hanna Valley', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Hazara Town', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Kharotabad', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Killi Kateer', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Kirani', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Kuchlak', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Mari Abad', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Parsi Colony', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Quetta Cantonment', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Satellite Town', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Quetta', area: 'Staff Collete (Quetta)', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Sibi', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Sibi', area: 'Luni', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Surab', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Turbat', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Turbat', area: 'Turbat Haji Shah', subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Usta Muhammad', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Uthal', area: null, subarea: null, blockPhase: null },
  { province: 'Balochistan', city: 'Zhob', area: null, subarea: null, blockPhase: null },

  // ─── Gilgit-Baltistan ─────────────────────────────────────────────
  { province: 'Gilgit-Baltistan', city: 'Gilgit', area: null, subarea: null, blockPhase: null },
  { province: 'Gilgit-Baltistan', city: 'Gilgit', area: 'Chilas', subarea: null, blockPhase: null },
  { province: 'Gilgit-Baltistan', city: 'Gilgit', area: 'Dainyor', subarea: null, blockPhase: null },
  { province: 'Gilgit-Baltistan', city: 'Gilgit', area: 'Gahkuch', subarea: null, blockPhase: null },
  { province: 'Gilgit-Baltistan', city: 'Gilgit', area: 'Skardu', subarea: null, blockPhase: null },

  // ─── Islamabad (additional) ───────────────────────────────────────
  { province: 'Islamabad', city: 'Islamabad', area: null, subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'B-17', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Bahria Enclave', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Bahria Enclave', subarea: null, blockPhase: 'Sector A' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Bahria Enclave', subarea: null, blockPhase: 'Sector C' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Bahria Enclave', subarea: null, blockPhase: 'Sector C-1' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Bahria Enclave', subarea: null, blockPhase: 'Sector E' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Bahria Enclave', subarea: null, blockPhase: 'Sector F' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Bahria Enclave', subarea: null, blockPhase: 'Sector L' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Bahria Enclave', subarea: null, blockPhase: 'Sector M' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Bahria Town', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Blue Area', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'C-14', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'C-15', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'CBR Town', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'D-12', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'D-17', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'DHA Islamabad-Rawalpindi', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'DHA Islamabad-Rawalpindi', subarea: null, blockPhase: 'Phase I' },
  { province: 'Islamabad', city: 'Islamabad', area: 'DHA Islamabad-Rawalpindi', subarea: null, blockPhase: 'Phase II' },
  { province: 'Islamabad', city: 'Islamabad', area: 'DHA Islamabad-Rawalpindi', subarea: null, blockPhase: 'Phase III' },
  { province: 'Islamabad', city: 'Islamabad', area: 'DHA Islamabad-Rawalpindi', subarea: null, blockPhase: 'Phase IV' },
  { province: 'Islamabad', city: 'Islamabad', area: 'DHA Islamabad-Rawalpindi', subarea: null, blockPhase: 'Phase V' },
  { province: 'Islamabad', city: 'Islamabad', area: 'DHA Islamabad-Rawalpindi', subarea: null, blockPhase: 'Phase VI' },
  { province: 'Islamabad', city: 'Islamabad', area: 'DHA Islamabad-Rawalpindi', subarea: null, blockPhase: 'Phase VII' },
  { province: 'Islamabad', city: 'Islamabad', area: 'Diplomatic Enclave', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'E-10', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'E-11', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'E-12', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'E-16', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'E-17', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'E-7', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'E-8', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'E-9', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-10', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-11', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-12', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-13', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-14', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-15', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-16', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-17', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-18', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-5', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-6', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-6', subarea: 'F-6/1', blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-6', subarea: 'F-6/2', blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-6', subarea: 'F-6/3', blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-6', subarea: 'F-6/4', blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-7', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-7', subarea: 'Jinnah Super Market', blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-8', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'F-9', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-10', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-11', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-12', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-13', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-14', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-15', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-16', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-17', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-18', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-4', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-5', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-6', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-6', subarea: 'Aabpara Market', blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-7', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-8', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-9', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'G-9', subarea: 'Karachi Company', blockPhase: null },

  // ─── Islamabad > Islamabad (H/I sectors + misc) ──────────────────
  { province: 'Islamabad', city: 'Islamabad', area: 'H-10', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'H-11', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'H-12', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'H-13', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'H-14', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'H-15', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'H-16', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'H-17', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'H-18', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'H-8', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'H-9', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'I-10', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'I-11', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'I-12', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'I-13', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'I-14', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'I-15', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'I-16', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'I-17', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'I-18', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'I-8', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'I-9', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Jinnah Garden', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Mera Jaffar', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'PWD', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Pakistan Secretariat', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Red Zone', subarea: 'Pakistan Secretariat', blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Soan Garden', subarea: null, blockPhase: null },
  { province: 'Islamabad', city: 'Islamabad', area: 'Tarnol', subarea: null, blockPhase: null },

  // ─── Khyber Pakhtunkhwa > Abbottabad ──────────────────────────────
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Abbottabad Public School', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Aliabad', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Amirabad', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Bagnotar', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Bilal Town', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Changla Gali', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Dhamtour', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Dunga Gali', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Ghora Dhaka', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Harnoi', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Havelian', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Jhangi', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Kakol', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Nathia Gali', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Nawan Shehr', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Noor Mang', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Qalandarabad', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Sikandrabad Colony', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Abbottabad', area: 'Thandiani', subarea: null, blockPhase: null },

  // ─── Khyber Pakhtunkhwa > Other cities ────────────────────────────
  { province: 'Khyber Pakhtunkhwa', city: 'Akora', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Akora', area: 'Akora Khattak', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Aman Garh', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Baffa', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Bannu', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Bat Khela', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Battagram', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Charsadda', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Charsadda', area: 'Charsadda Town (Nd)', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Dera Ismail Khan', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Dera Ismail Khan', area: 'Kulachi', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Hangu', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Hangu', area: 'Hangu S.O', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Hangu', area: 'P.T.S.Hangu', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Haripur', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Haripur', area: 'Haripur Central Jail', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Haripur', area: 'Haripur City Nd', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Haripur', area: 'Haripur Telephone Factory', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Havelian', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Havelian', area: 'Ammunition Depot Havelian', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Havelian', area: 'Pak Ordinance Factory Havelian', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Karak', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Khalabat', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Khalabat', area: 'Khalabat Township', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Kohat', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Kohat', area: 'Cadet College Kohat S.O', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Kohat', area: 'Officers Training School Kohat', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Kulachi', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Kulachi', area: 'Chakar Khan Kulachi', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Kulachi', area: 'Dera Ismail Khan', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Lachi', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Lachi', area: 'Lachi Mong', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Lakki', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Lakki', area: 'Lakki Marwat', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Lakki', area: 'Lakki R.Station', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Lakki', area: 'Lakki Shah', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mansehra', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mansehra', area: 'Mansehra City Nd', subarea: null, blockPhase: null },

  // ─── Khyber Pakhtunkhwa > Mardan ──────────────────────────────────
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: 'Baghdada', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: 'Bakhshali', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: 'Bala Garhi', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: 'Bijli Ghar', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: 'Mardan Cantonment', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: 'Mardan Sugar Crops', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: 'Muslimabad', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: 'Par Hoti', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: 'Sawal Dher', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: 'Shergarh', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: 'Takht Bahi', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mardan', area: 'Toru', subarea: null, blockPhase: null },

  // ─── Khyber Pakhtunkhwa > Mingora, Nowshera, Pabbi, etc. ─────────
  { province: 'Khyber Pakhtunkhwa', city: 'Mingora', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mingora', area: 'Matta', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Mingora', area: 'Saidu Sharif', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Nowshera Cantonment', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Nowshera Cantonment', area: 'Feroz Sons Nowshera', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Nowshera Cantonment', area: 'Nowshera Khurd', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Nowshera Cantonment', area: 'Risalpur', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Pabbi', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Pabbi', area: 'Pabbi Railway Station', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Paharpur', area: null, subarea: null, blockPhase: null },

  // ─── Khyber Pakhtunkhwa > Peshawar (additional) ──────────────────
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Adezai', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Amb', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'B.I.& S.E. Peshawar', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Badaber', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Bela Baramad Khel', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Chaghar Matti', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Chamkani', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Choughalpura', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Danish Abad', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Faqirabad', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Gor Khuttree', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Govt. College Of Tech Peshawar', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Gulbahar', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Hashtnagri', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Landi Yarghajo', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Mathra', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Mattani', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Mohabat Khel', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Mohalla Jam-e-shifa', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Naguman', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Nasir Bagh', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Nishterabad', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Ormur', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Passani', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Peshawar Airport', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Peshawar Cantonment', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Peshawar Cantt (N.P.O.)', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Peshawar City Railway Station', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Peshawar Kutchery', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Peshawar Saddar Bazar', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Peshawar Secretariat', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Peshawar Town I', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Peshawar Town II', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Peshawar Town III', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Peshawar Town IV', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Peshawar University G.P.O.', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Putwar Bala', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Sethi Mohallah', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Sethi Town', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Shamshato Refugee Camp', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Surizai Bala', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Peshawar', area: 'Tehkal Bala', subarea: null, blockPhase: null },

  // ─── Khyber Pakhtunkhwa > Remaining cities ────────────────────────
  { province: 'Khyber Pakhtunkhwa', city: 'Risalpur Cantonment', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Risalpur Cantonment', area: 'Nowshera', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Sarai Naurang', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Shabqadar', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Shabqadar', area: 'Shabqadar Fort', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Shabqadar', area: 'Shabqadar Village', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Swabi', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Swabi', area: 'Ambar', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Swabi', area: 'Swabi Maira', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Tangi', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Tangi', area: 'Pir Tangi', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Tangi', area: 'Spin Tangi', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Tangi', area: 'Tangi Gala', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Tangi', area: 'Tangi Payeen', subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Tank', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Thal', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Topi', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Upper Dir', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Utmanzai', area: null, subarea: null, blockPhase: null },
  { province: 'Khyber Pakhtunkhwa', city: 'Zaida', area: null, subarea: null, blockPhase: null },
];

async function seed() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const provincesCol = db.collection('provinces');
    const citiesCol = db.collection('cities');
    const areasCol = db.collection('areas');

    // Drop old collections (including the flat one from before)
    for (const name of ['provinces', 'cities', 'areas', 'location_hierarchies']) {
      try { await db.collection(name).drop(); } catch (_) { /* may not exist */ }
    }
    console.log('Cleared existing location collections');

    // ── Step 1: Build unique provinces ──────────────────────────────
    const provinceMap = new Map(); // name → ObjectId
    for (const row of rawData) {
      if (!provinceMap.has(row.province)) {
        provinceMap.set(row.province, new ObjectId());
      }
    }

    const provinceDocs = [];
    for (const [name, _id] of provinceMap) {
      provinceDocs.push({ _id, name, createdAt: now, updatedAt: now });
    }
    await provincesCol.insertMany(provinceDocs);
    console.log(`Inserted ${provinceDocs.length} provinces`);

    // ── Step 2: Build unique cities ─────────────────────────────────
    const cityMap = new Map(); // "province|city" → ObjectId
    for (const row of rawData) {
      const key = `${row.province}|${row.city}`;
      if (!cityMap.has(key)) {
        cityMap.set(key, new ObjectId());
      }
    }

    const cityDocs = [];
    for (const [key, _id] of cityMap) {
      const [provinceName, cityName] = key.split('|');
      cityDocs.push({
        _id,
        name: cityName,
        provinceId: provinceMap.get(provinceName),
        createdAt: now,
        updatedAt: now,
      });
    }
    await citiesCol.insertMany(cityDocs);
    console.log(`Inserted ${cityDocs.length} cities`);

    // ── Step 3: Build areas with subareas[] and blockPhases[] ───────
    // Key: "province|city|area" → { subareas: Set, blockPhases: Set }
    const areaMap = new Map();

    for (const row of rawData) {
      if (!row.area) continue; // city-level row with no area (e.g. Punjab > Hasilpur)

      const cityKey = `${row.province}|${row.city}`;
      const areaKey = `${cityKey}|${row.area}`;

      if (!areaMap.has(areaKey)) {
        areaMap.set(areaKey, {
          name: row.area,
          cityId: cityMap.get(cityKey),
          subareas: new Set(),
          blockPhases: new Set(),
        });
      }

      const entry = areaMap.get(areaKey);
      if (row.subarea) entry.subareas.add(row.subarea);
      if (row.blockPhase) entry.blockPhases.add(row.blockPhase);
    }

    const areaDocs = [];
    for (const [, entry] of areaMap) {
      areaDocs.push({
        _id: new ObjectId(),
        name: entry.name,
        cityId: entry.cityId,
        subareas: [...entry.subareas],
        blockPhases: [...entry.blockPhases],
        createdAt: now,
        updatedAt: now,
      });
    }
    await areasCol.insertMany(areaDocs);
    console.log(`Inserted ${areaDocs.length} areas`);

    // ── Step 4: Create indexes ──────────────────────────────────────
    await provincesCol.createIndex({ name: 1 }, { unique: true });
    await citiesCol.createIndex({ provinceId: 1 });
    await citiesCol.createIndex({ provinceId: 1, name: 1 }, { unique: true });
    await areasCol.createIndex({ cityId: 1 });
    await areasCol.createIndex({ cityId: 1, name: 1 }, { unique: true });
    console.log('Indexes created');

    // ── Summary ─────────────────────────────────────────────────────
    console.log('\nSeed summary:');
    console.log(`  Provinces: ${provinceDocs.length}`);
    console.log(`  Cities:    ${cityDocs.length}`);
    console.log(`  Areas:     ${areaDocs.length}`);
    console.log('Location seed complete!');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
