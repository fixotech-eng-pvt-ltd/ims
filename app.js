// ================================================================
// Fixotech Smart Calculator - App Logic (v2.0)
// All formulas verified against worksheet.xlsx
// ================================================================

// ----------------------------------------------------------------
// PRODUCT DATABASE
// ----------------------------------------------------------------
const PRODUCTS_DB = {

  // ============ GI - HOTDIP (Steel Density = 8000) ============

  gi_cable_tray_cover: {
    sheet: 'gi', name: 'Cable Tray with Cover', type: 'linear',
    inputs: [
      { name: 'T1', label: 'Bottom Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W1', label: 'Bottom Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'Limb', label: 'Bottom Side Lip/Limb (mm)', placeholder: '10' },
      { name: 'T2', label: 'Cover Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'Collor', label: 'Cover Side Flange (mm)', placeholder: '10' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '75' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const W2 = v.W1;
      const BDS = ov('Bottom Dev Size (mm)', v.W1 + (v.H * 2) + (v.Limb * 2));
      const CDS = ov('Cover Dev Size (mm)', W2 + (v.Collor * 2));
      const BW = ov('Bottom Weight (kg/m)', BDS * v.T1 * 8000 / 1e6);
      const CW = ov('Cover Weight (kg/m)', CDS * v.T2 * 8000 / 1e6);
      const weight = ov('Total Weight (kg/m)', BW + CW);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP);
      return {
        'Bottom Dev Size (mm)': BDS.toFixed(1), 'Cover Dev Size (mm)': CDS.toFixed(1),
        'Bottom Weight (kg/m)': BW.toFixed(3), 'Cover Weight (kg/m)': CW.toFixed(3),
        'Total Weight (kg/m)': weight.toFixed(3), 'Weight x RM (Rs/m)': WR.toFixed(2),
        'Total Rate (Rs/m)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  gi_perforated_cable_tray: {
    sheet: 'gi', name: 'Perforated Cable Tray', type: 'linear',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'Limb', label: 'Side Lip/Limb (mm)', placeholder: '10' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '75' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const DS = ov('Development Size (mm)', v.W + (v.H * 2) + (v.Limb * 2));
      const weight = ov('Total Weight (kg/m)', DS * v.T * 8000 / 1e6);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP);
      return {
        'Development Size (mm)': DS.toFixed(1), 'Total Weight (kg/m)': weight.toFixed(3),
        'Weight x RM (Rs/m)': WR.toFixed(2), 'Total Rate (Rs/m)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  gi_cover_cable_tray: {
    sheet: 'gi', name: 'Cover Cable Tray', type: 'linear',
    inputs: [
      { name: 'T1', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W1', label: 'Width (mm)', placeholder: '200' },
      { name: 'Limb', label: 'Side Lip/Limb (mm)', placeholder: '10' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '75' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const DS = ov('Development Size (mm)', v.W1 + (v.Limb * 2));
      const weight = ov('Total Weight (kg/m)', DS * v.T1 * 8000 / 1e6);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG);
      return {
        'Development Size (mm)': DS.toFixed(1), 'Total Weight (kg/m)': weight.toFixed(3),
        'Weight x RM (Rs/m)': WR.toFixed(2), 'Total Rate (Rs/m)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  gi_pg_raceway_cover_partition: {
    sheet: 'gi', name: 'PG (GI) Raceway with Cover (Partition)', type: 'linear',
    inputs: [
      { name: 'T1', label: 'Bottom Thickness (mm)', placeholder: '1.6', step: 0.1 },
      { name: 'W1', label: 'Bottom Width (mm)', placeholder: '100' },
      { name: 'H', label: 'Height (mm)', placeholder: '50' },
      { name: 'P1', label: 'Partition 1 Height (mm)', placeholder: '0' },
      { name: 'P2', label: 'Partition 2 Height (mm)', placeholder: '0' },
      { name: 'P3', label: 'Partition 3 Height (mm)', placeholder: '0' },
      { name: 'Collor', label: 'Cover Flange (mm)', placeholder: '10' },
      { name: 'T2', label: 'Cover Thickness (mm)', placeholder: '1.6', step: 0.1 },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '75' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const W2 = v.W1;
      const BDS = ov('Bottom Dev Size (mm)', v.W1 + (v.H * 2) + (v.Collor * 2) + v.P1 + v.P2 + v.P3);
      const CDS = ov('Cover Dev Size (mm)', W2 + (v.Collor * 2));
      const BW = ov('Bottom Weight (kg/m)', BDS * v.T1 * 8000 / 1e6);
      const CW = ov('Cover Weight (kg/m)', CDS * v.T2 * 8000 / 1e6);
      const weight = ov('Total Weight (kg/m)', BW + CW);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP);
      return {
        'Bottom Dev Size (mm)': BDS.toFixed(1), 'Cover Dev Size (mm)': CDS.toFixed(1),
        'Bottom Weight (kg/m)': BW.toFixed(3), 'Cover Weight (kg/m)': CW.toFixed(3),
        'Total Weight (kg/m)': weight.toFixed(3), 'Weight x RM (Rs/m)': WR.toFixed(2),
        'Total Rate (Rs/m)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  gi_ladder_boltable_300: {
    sheet: 'gi', name: 'Ladder Cable Tray (Boltable) 300 c/c', type: 'linear',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '75' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' },
      { name: 'BNW', label: 'Bolts/Nuts/Washers (Rs/m)', placeholder: '35' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const SF = ov('Side Frame Wt (kg/m)', (v.T * (v.H + 50) * 8000 / 1e6) * 2);
      const rungs = ov('Rungs Weight (kg/m)', (((v.T * (v.W + 50) * 60 * 8) / 1e6) * 8) / 2.5);
      const JPW = ov('Joint Plate Wt (kg/m)', (v.H - 10) * 175 * 2 * 8 / 1e6);
      const weight = ov('Total Weight (kg/m)', SF + rungs + JPW);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP + v.BNW);
      return {
        'Side Frame Wt (kg/m)': SF.toFixed(3), 'Rungs Weight (kg/m)': rungs.toFixed(3),
        'Joint Plate Wt (kg/m)': JPW.toFixed(3), 'Total Weight (kg/m)': weight.toFixed(3),
        'Weight x RM (Rs/m)': WR.toFixed(2), 'Total Rate (Rs/m)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  gi_ladder_boltable_250: {
    sheet: 'gi', name: 'Ladder Cable Tray (Boltable) 250 c/c', type: 'linear',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '75' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' },
      { name: 'BNW', label: 'Bolts/Nuts/Washers (Rs/m)', placeholder: '35' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const SF = ov('Side Frame Wt (kg/m)', (v.T * (v.H + 50) * 8000 / 1e6) * 2);
      const rungs = ov('Rungs Weight (kg/m)', ((v.T * (v.W + 50) * 60 * 8) / 1e6) * 4);
      const JPW = ov('Joint Plate Wt (kg/m)', (v.H - 10) * 175 * 2 * 8 / 1e6);
      const weight = ov('Total Weight (kg/m)', SF + rungs + JPW);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP + v.BNW);
      return {
        'Side Frame Wt (kg/m)': SF.toFixed(3), 'Rungs Weight (kg/m)': rungs.toFixed(3),
        'Joint Plate Wt (kg/m)': JPW.toFixed(3), 'Total Weight (kg/m)': weight.toFixed(3),
        'Weight x RM (Rs/m)': WR.toFixed(2), 'Total Rate (Rs/m)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  gi_ladder_welded_300: {
    sheet: 'gi', name: 'Ladder Cable Tray (Welded) 300 c/c', type: 'linear',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '71' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '100' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const SF = ov('Side Frame Wt (kg/m)', (v.T * (v.H + 30) * 8000 / 1e6) * 2);
      const rungs = ov('Rungs Weight (kg/m)', (((v.T * v.W * 60 * 8) / 1e6) * 8) / 2.5);
      const JPW = ov('Joint Plate Wt (kg/m)', (v.H - 10) * 175 * 2 * 8 / 1e6);
      const weight = ov('Total Weight (kg/m)', SF + rungs + JPW);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP);
      return {
        'Side Frame Wt (kg/m)': SF.toFixed(3), 'Rungs Weight (kg/m)': rungs.toFixed(3),
        'Joint Plate Wt (kg/m)': JPW.toFixed(3), 'Total Weight (kg/m)': weight.toFixed(3),
        'Weight x RM (Rs/m)': WR.toFixed(2), 'Total Rate (Rs/m)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  gi_ladder_welded_250: {
    sheet: 'gi', name: 'Ladder Cable Tray (Welded) 250 c/c', type: 'linear',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '71' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '100' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const SF = ov('Side Frame Wt (kg/m)', (v.T * (v.H + 30) * 8000 / 1e6) * 2);
      const rungs = ov('Rungs Weight (kg/m)', ((v.T * v.W * 60 * 8) / 1e6) * 4);
      const JPW = ov('Joint Plate Wt (kg/m)', (v.H - 10) * 175 * 2 * 8 / 1e6);
      const weight = ov('Total Weight (kg/m)', SF + rungs + JPW);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP);
      return {
        'Side Frame Wt (kg/m)': SF.toFixed(3), 'Rungs Weight (kg/m)': rungs.toFixed(3),
        'Joint Plate Wt (kg/m)': JPW.toFixed(3), 'Total Weight (kg/m)': weight.toFixed(3),
        'Weight x RM (Rs/m)': WR.toFixed(2), 'Total Rate (Rs/m)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  gi_perf_tee_bend: {
    sheet: 'gi', name: 'Perforated Tee Bend', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '300' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const DS1 = ov('Dev Size 1 (mm)', v.W + (v.R * 2) + 75 + 75);
      const DS2 = ov('Dev Size 2 (mm)', v.W + v.R + v.H + 75);
      const weight = ov('Total Weight (kg/pc)', DS1 * DS2 * v.T * 8 / 1e6);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'Dev Size 1 (mm)': DS1.toFixed(1), 'Dev Size 2 (mm)': DS2.toFixed(1),
        'Total Weight (kg/pc)': weight.toFixed(3), 'Weight x RM (Rs/pc)': WR.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  gi_perf_cross_bend: {
    sheet: 'gi', name: 'Perforated Cross Bend', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '300' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const DS1 = ov('Dev Size 1 (mm)', v.W + (v.R * 2) + 75 + 75);
      const DS2 = ov('Dev Size 2 (mm)', v.W + (v.R * 2) + 75 + 75);
      const weight = ov('Total Weight (kg/pc)', DS1 * DS2 * v.T * 8 / 1e6);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'Dev Size 1 (mm)': DS1.toFixed(1), 'Dev Size 2 (mm)': DS2.toFixed(1),
        'Total Weight (kg/pc)': weight.toFixed(3), 'Weight x RM (Rs/pc)': WR.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  gi_junction_box: {
    sheet: 'gi', name: 'Junction Box', type: 'piece',
    inputs: [
      { name: 'W1', label: 'Bottom Width W1 (mm)', placeholder: '150' },
      { name: 'W2', label: 'Bottom Length W2 (mm)', placeholder: '150' },
      { name: 'T', label: 'Bottom Thickness (mm)', placeholder: '1.6', step: 0.1 },
      { name: 'Cover_T', label: 'Cover Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'FDS', label: 'Flange Dev Size (mm)', placeholder: '35' },
      { name: 'Flange_T', label: 'Flange Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'SDC_Qty', label: 'Dummy Cover Qty (Nos)', placeholder: '1' },
      { name: 'SDC_H', label: 'Dummy Cover Height (mm)', placeholder: '50' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '250' },
      { name: 'Leg', label: 'Leg Fab. Charges (Rs/pc)', placeholder: '60' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BW = ov('Bottom Weight (kg)', v.W1 * v.W2 * v.T * 8 / 1e6);
      const CW = ov('Cover Weight (kg)', v.W1 * v.W2 * v.Cover_T * 8 / 1e6);
      const FW = ov('Flange Weight (kg)', (v.W1 * 4) * v.FDS * v.Flange_T * 8 / 1e6);
      const SDCW = ov('Dummy Cover Wt (kg)', v.SDC_Qty * v.SDC_H * v.W1 * 8 / 1e6 * 2);
      const weight = ov('Total Weight (kg)', BW + CW + FW + SDCW);
      const total = ov('Total Cost (Rs/pc)', weight * v.RM + v.MFG + v.Leg);
      return {
        'Bottom Weight (kg)': BW.toFixed(3), 'Cover Weight (kg)': CW.toFixed(3),
        'Flange Weight (kg)': FW.toFixed(3), 'Dummy Cover Wt (kg)': SDCW.toFixed(3),
        'Total Weight (kg)': weight.toFixed(3), 'Total Cost (Rs/pc)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  gi_horizontal_bend_perf: {
    sheet: 'gi', name: 'Horizontal Bend Perforated', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '150' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '76' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '250' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const DS1 = ov('Dev Size (mm)', v.W + v.H + v.R + 75);
      const DS2 = DS1;
      const weight = ov('Total Weight (kg/pc)', v.T * DS1 * DS2 * 8 / 1e6);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'Dev Size (mm)': DS1.toFixed(1), 'Total Weight (kg/pc)': weight.toFixed(3),
        'Weight x RM (Rs/pc)': WR.toFixed(2), 'Total Cost (Rs/pc)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  gi_horizontal_bend_perf_cover: {
    sheet: 'gi', name: 'Horizontal Bend Perf. with Cover', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '150' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '76' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '250' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BDS1 = ov('Bottom Dev Size (mm)', v.W + v.H + v.R + 75 + 10);
      const BDS2 = BDS1;
      const CDS1 = ov('Cover Dev Size (mm)', v.W + v.R + 10);
      const CDS2 = CDS1;
      const BW = ov('Bottom Weight (kg/pc)', v.T * BDS1 * BDS2 * 8 / 1e6);
      const CW = ov('Cover Weight (kg/pc)', v.T * CDS1 * CDS2 * 8 / 1e6);
      const weight = ov('Total Weight (kg/pc)', BW + CW);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'Bottom Dev Size (mm)': BDS1.toFixed(1), 'Cover Dev Size (mm)': CDS1.toFixed(1),
        'Bottom Weight (kg/pc)': BW.toFixed(3), 'Cover Weight (kg/pc)': CW.toFixed(3),
        'Total Weight (kg/pc)': weight.toFixed(3), 'Weight x RM (Rs/pc)': WR.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  gi_reducer_bend: {
    sheet: 'gi', name: 'Reducer Bend', type: 'piece',
    inputs: [
      { name: 'PMR', label: 'Per Meter Rate (Rs/m)', placeholder: '300' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '150' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const R7 = ov('R x 0.7 (Rs)', v.PMR * 0.7);
      const total = ov('Total Cost (Rs/pc)', R7 + v.MFG);
      return { 'R x 0.7 (Rs)': R7.toFixed(2), 'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight: 0 };
    }
  },

  gi_tee_bend_cover: {
    sheet: 'gi', name: 'Tee Bend with Cover', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '150' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '76' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BDS1 = ov('Bottom DS 1 (mm)', v.W + (v.R * 2) + 75 + 75);
      const BDS2 = ov('Bottom DS 2 (mm)', v.W + v.R + v.H + 75);
      const CDS1 = ov('Cover DS (mm)', v.W + (v.R * 2) + 10 + 10);
      const CDS2 = CDS1;
      const BW = ov('Bottom Wt (kg/pc)', v.T * BDS1 * BDS2 * 8 / 1e6);
      const CW = ov('Cover Wt (kg/pc)', v.T * CDS1 * CDS2 * 8 / 1e6);
      const weight = ov('Total Weight (kg/pc)', BW + CW);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'Bottom DS 1 (mm)': BDS1.toFixed(1), 'Bottom DS 2 (mm)': BDS2.toFixed(1),
        'Cover DS (mm)': CDS1.toFixed(1), 'Bottom Wt (kg/pc)': BW.toFixed(3),
        'Cover Wt (kg/pc)': CW.toFixed(3), 'Total Weight (kg/pc)': weight.toFixed(3),
        'Weight x RM (Rs/pc)': WR.toFixed(2), 'Total Cost (Rs/pc)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  gi_cross_bend_cover: {
    sheet: 'gi', name: 'Cross Bend with Cover', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '150' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '76' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BDS1 = ov('Bottom DS (mm)', v.W + (v.R * 2) + 75 + 75);
      const BDS2 = BDS1;
      const CDS1 = ov('Cover DS (mm)', v.W + (v.R * 2) + 10 + 10);
      const CDS2 = CDS1;
      const BW = ov('Bottom Wt (kg/pc)', v.T * BDS1 * BDS2 * 8 / 1e6);
      const CW = ov('Cover Wt (kg/pc)', v.T * CDS1 * CDS2 * 8 / 1e6);
      const weight = ov('Total Weight (kg/pc)', BW + CW);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'Bottom DS (mm)': BDS1.toFixed(1), 'Cover DS (mm)': CDS1.toFixed(1),
        'Bottom Wt (kg/pc)': BW.toFixed(3), 'Cover Wt (kg/pc)': CW.toFixed(3),
        'Total Weight (kg/pc)': weight.toFixed(3), 'Weight x RM (Rs/pc)': WR.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  gi_h_bend_ladder: {
    sheet: 'gi', name: 'H Bend Ladder', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '300' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '73' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const F = (v.W * 2) + (v.R * 2);
      const G = F * 3.14 / 4;
      const I = G + 200;
      const J = (v.R * 2) * 3.14 / 4 + 200;
      const K = ov('SF Length (mm)', I + J);
      const SF_Wt = ov('SF Wt (kg/pc)', K * v.T * (v.H + 30) * 8 / 1e6);
      const Rungs_Total = ov('Rungs Wt (kg/pc)', v.T * v.W * 75 * 8 / 1e6 * 5);
      const JP_Wt = ov('JP Wt (kg/pc)', ((v.H - 10) * 175 * 2 * 8 / 1e6) * 2);
      const weight = ov('Total Weight (kg/pc)', SF_Wt + Rungs_Total + JP_Wt);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'SF Length (mm)': K.toFixed(1), 'SF Wt (kg/pc)': SF_Wt.toFixed(3),
        'Rungs Wt (kg/pc)': Rungs_Total.toFixed(3), 'JP Wt (kg/pc)': JP_Wt.toFixed(3),
        'Total Weight (kg/pc)': weight.toFixed(3), 'Weight x RM (Rs/pc)': WR.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  gi_vertical_bend: {
    sheet: 'gi', name: 'Vertical Bend', type: 'piece',
    inputs: [
      { name: 'PMR', label: 'Per Meter Rate (Rs/m)', placeholder: '300' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '300' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const R7 = ov('R x 0.7 (Rs)', v.PMR * 0.7);
      const total = ov('Total Cost (Rs/pc)', R7 + v.MFG);
      return { 'R x 0.7 (Rs)': R7.toFixed(2), 'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight: 0 };
    }
  },

  gi_perf_unequal_tee_bend: {
    sheet: 'gi', name: 'Perforated Unequal Tee Bend', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W1', label: 'Width W1 (mm)', placeholder: '200' },
      { name: 'W2', label: 'Width W2 (mm)', placeholder: '200' },
      { name: 'W3', label: 'Width W3 (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '300' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '73' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const DS1 = ov('DS 1 (mm)', v.W2 + (v.R * 2) + 75 + 75);
      const DS2 = ov('DS 2 (mm)', v.W1 + v.R + v.H + 75);
      const weight = ov('Total Weight (kg/pc)', DS1 * DS2 * v.T * 8 / 1e6);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'DS 1 (mm)': DS1.toFixed(1), 'DS 2 (mm)': DS2.toFixed(1),
        'Total Weight (kg/pc)': weight.toFixed(3), 'Weight x RM (Rs/pc)': WR.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  gi_perf_unequal_tee_bend_cover: {
    sheet: 'gi', name: 'Perf. Unequal Tee Bend with Cover', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W1', label: 'Width W1 (mm)', placeholder: '200' },
      { name: 'W2', label: 'Width W2 (mm)', placeholder: '200' },
      { name: 'W3', label: 'Width W3 (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '300' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '73' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '800' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BDS1 = ov('Bottom DS 1 (mm)', v.W2 + (v.R * 2) + 75 + 75);
      const BDS2 = ov('Bottom DS 2 (mm)', v.W1 + v.R + v.H + 75);
      const CDS1 = ov('Cover DS 1 (mm)', v.W2 + (v.R * 2) + 10 + 10);
      const CDS2 = ov('Cover DS 2 (mm)', v.W1 + v.R + 10);
      const BW = ov('Bottom Wt (kg/pc)', BDS1 * BDS2 * v.T * 8 / 1e6);
      const CW = ov('Cover Wt (kg/pc)', CDS1 * CDS2 * v.T * 8 / 1e6);
      const weight = ov('Total Weight (kg/pc)', BW + CW);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'Bottom DS 1 (mm)': BDS1.toFixed(1), 'Bottom DS 2 (mm)': BDS2.toFixed(1),
        'Cover DS 1 (mm)': CDS1.toFixed(1), 'Cover DS 2 (mm)': CDS2.toFixed(1),
        'Bottom Wt (kg/pc)': BW.toFixed(3), 'Cover Wt (kg/pc)': CW.toFixed(3),
        'Total Weight (kg/pc)': weight.toFixed(3), 'Weight x RM (Rs/pc)': WR.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  gi_vertical_tee_bend_ladder: {
    sheet: 'gi', name: 'Vertical Tee Bend Ladder', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '300' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '73' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const DS1 = ov('SF DS 1 (mm)', v.H + (v.R * 2) + 75 + 75);
      const DS2 = ov('SF DS 2 (mm)', v.R + v.H + 75 + 10);
      const SF_Wt = ov('SF Wt (kg/pc)', (DS1 * DS2 * v.T * 8 / 1e6) * 2);
      const Rung_Wt = ov('Rungs Wt (kg/pc)', v.T * v.W * 55 * 8 / 1e6 * 10);
      const weight = ov('Total Weight (kg/pc)', SF_Wt + Rung_Wt);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'SF DS 1 (mm)': DS1.toFixed(1), 'SF DS 2 (mm)': DS2.toFixed(1),
        'SF Wt (kg/pc)': SF_Wt.toFixed(3), 'Rungs Wt (kg/pc)': Rung_Wt.toFixed(3),
        'Total Weight (kg/pc)': weight.toFixed(3), 'Weight x RM (Rs/pc)': WR.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  gi_tee_bend_cover_partition: {
    sheet: 'gi', name: 'Tee Bend with Cover (Partition)', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'P1', label: 'Partition 1 (mm)', placeholder: '10' },
      { name: 'P2', label: 'Partition 2 (mm)', placeholder: '10' },
      { name: 'R', label: 'Radius (mm)', placeholder: '150' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '76' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BDS1 = ov('Bottom DS 1 (mm)', v.W + v.P1 + v.P2 + (v.R * 2) + 75 + 75);
      const BDS2 = ov('Bottom DS 2 (mm)', v.W + v.R + v.H + 75);
      const CDS1 = ov('Cover DS (mm)', v.W + (v.R * 2) + 10 + 10);
      const CDS2 = CDS1;
      const BW = ov('Bottom Wt (kg/pc)', v.T * BDS1 * BDS2 * 8 / 1e6);
      const CW = ov('Cover Wt (kg/pc)', CDS1 * CDS2 * v.T * 8 / 1e6);
      const weight = ov('Total Weight (kg/pc)', BW + CW);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'Bottom DS 1 (mm)': BDS1.toFixed(1), 'Bottom DS 2 (mm)': BDS2.toFixed(1),
        'Cover DS (mm)': CDS1.toFixed(1), 'Bottom Wt (kg/pc)': BW.toFixed(3),
        'Cover Wt (kg/pc)': CW.toFixed(3), 'Total Weight (kg/pc)': weight.toFixed(3),
        'Weight x RM (Rs/pc)': WR.toFixed(2), 'Total Cost (Rs/pc)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  gi_ladder_equal_tee: {
    sheet: 'gi', name: 'Ladder Equal Tee', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '300' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '110' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '1250' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const SF_DS1 = (v.R * 2) * 3.14 / 4 + 200;
      const SF_DS2 = v.W + (v.R * 2) + 200;
      const SF_DS = ov('SF DS (mm)', (SF_DS1 * 2) + SF_DS2);
      const SF_Wt = ov('SF Wt (kg/pc)', SF_DS * (v.H + 30) * v.T * 8 / 1e6);
      const Rung_Wt = ov('Rungs Wt (kg/pc)', v.T * v.W * 65 * 8 / 1e6 * 10);
      const JP_Wt = ov('JP Wt (kg/pc)', 2.08 / 4 * 6);
      const weight = ov('Total Weight (kg/pc)', SF_Wt + Rung_Wt + JP_Wt);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'SF DS (mm)': SF_DS.toFixed(1), 'SF Wt (kg/pc)': SF_Wt.toFixed(3),
        'Rungs Wt (kg/pc)': Rung_Wt.toFixed(3), 'JP Wt (kg/pc)': JP_Wt.toFixed(3),
        'Total Weight (kg/pc)': weight.toFixed(3), 'Weight x RM (Rs/pc)': WR.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  gi_ladder_equal_cross: {
    sheet: 'gi', name: 'Ladder Equal Cross', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '300' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '110' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '1500' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const SF_DS = ov('SF DS (mm)', ((v.R * 2) * 3.14 / 4 + 200) * 4);
      const SF_Wt = ov('SF Wt (kg/pc)', SF_DS * (v.H + 30) * v.T * 8 / 1e6);
      const Rung_Wt = ov('Rungs Wt (kg/pc)', v.T * v.W * 65 * 8 / 1e6 * 10);
      const JP_Wt = ov('JP Wt (kg/pc)', 2.08 * 2);
      const weight = ov('Total Weight (kg/pc)', SF_Wt + Rung_Wt + JP_Wt);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG);
      return {
        'SF DS (mm)': SF_DS.toFixed(1), 'SF Wt (kg/pc)': SF_Wt.toFixed(3),
        'Rungs Wt (kg/pc)': Rung_Wt.toFixed(3), 'JP Wt (kg/pc)': JP_Wt.toFixed(3),
        'Total Weight (kg/pc)': weight.toFixed(3), 'Weight x RM (Rs/pc)': WR.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  // ============ PC - ALUMINIUM ============

  pc_cable_tray_cover: {
    sheet: 'pc', name: 'PC Cable Tray with Cover', type: 'linear',
    inputs: [
      { name: 'T1', label: 'Bottom Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W1', label: 'Bottom Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'Collor', label: 'Bottom Side Lip (mm)', placeholder: '10' },
      { name: 'T2', label: 'Cover Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'Collor2', label: 'Cover Side Flange (mm)', placeholder: '10' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '100' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' },
      { name: 'PCRate', label: 'PC Rate (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BDS = ov('Bottom DS (mm)', v.W1 + (v.H * 2) + (v.Collor * 2));
      const CDS = ov('Cover DS (mm)', v.W1 + (v.Collor2 * 2));
      const BW = BDS * v.T1 * 8000 / 1e6;
      const CW = CDS * v.T2 * 8000 / 1e6;
      const weight = ov('Total Weight (kg/m)', BW + CW);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const sqft = ov('PC Area (sqft/m)', (BDS + CDS) * 2000 / 645.16 / 144);
      const PCC = ov('PC Cost (Rs/m)', sqft * v.PCRate);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP + PCC);
      return {
        'Bottom DS (mm)': BDS.toFixed(1), 'Cover DS (mm)': CDS.toFixed(1),
        'PC Area (sqft/m)': sqft.toFixed(2), 'Total Weight (kg/m)': weight.toFixed(3),
        'Weight x RM (Rs/m)': WR.toFixed(2), 'PC Cost (Rs/m)': PCC.toFixed(2),
        'Total Rate (Rs/m)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  pc_perf_cable_tray: {
    sheet: 'pc', name: 'PC Perforated Cable Tray', type: 'linear',
    inputs: [
      { name: 'T1', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W1', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'Collor', label: 'Side Lip (mm)', placeholder: '10' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '50' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' },
      { name: 'PCRate', label: 'PC Rate (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const DS = ov('Dev Size (mm)', v.W1 + (v.H * 2) + (v.Collor * 2));
      const sqft = ov('PC Area (sqft/m)', DS * 2000 / 645.16 / 144);
      const weight = ov('Total Weight (kg/m)', DS * v.T1 * 8000 / 1e6);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const PCC = ov('PC Cost (Rs/m)', sqft * v.PCRate);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP + PCC);
      return {
        'Dev Size (mm)': DS.toFixed(1), 'PC Area (sqft/m)': sqft.toFixed(2),
        'Total Weight (kg/m)': weight.toFixed(3), 'Weight x RM (Rs/m)': WR.toFixed(2),
        'PC Cost (Rs/m)': PCC.toFixed(2), 'Total Rate (Rs/m)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  pc_cover_cable_tray: {
    sheet: 'pc', name: 'PC Cover Cable Tray', type: 'linear',
    inputs: [
      { name: 'T1', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'Collor', label: 'Side Lip (mm)', placeholder: '10' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '50' },
      { name: 'PCRate', label: 'PC Rate (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const DS = ov('Dev Size (mm)', v.W + (v.Collor * 2));
      const sqft = ov('PC Area (sqft/m)', DS * 2000 / 645.16 / 144);
      const weight = ov('Total Weight (kg/m)', DS * v.T1 * 8000 / 1e6);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const PCC = ov('PC Cost (Rs/m)', sqft * v.PCRate);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + PCC);
      return {
        'Dev Size (mm)': DS.toFixed(1), 'PC Area (sqft/m)': sqft.toFixed(2),
        'Total Weight (kg/m)': weight.toFixed(3), 'Weight x RM (Rs/m)': WR.toFixed(2),
        'PC Cost (Rs/m)': PCC.toFixed(2), 'Total Rate (Rs/m)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  pc_raceway_cover_partition: {
    sheet: 'pc', name: 'PC Raceway with Cover (Partition)', type: 'linear',
    inputs: [
      { name: 'T1', label: 'Bottom Thickness (mm)', placeholder: '1.6', step: 0.1 },
      { name: 'W1', label: 'Bottom Width (mm)', placeholder: '100' },
      { name: 'H', label: 'Height (mm)', placeholder: '50' },
      { name: 'P1', label: 'Partition 1 (mm)', placeholder: '0' },
      { name: 'P2', label: 'Partition 2 (mm)', placeholder: '0' },
      { name: 'P3', label: 'Partition 3 (mm)', placeholder: '0' },
      { name: 'Collor', label: 'Bottom Flange (mm)', placeholder: '10' },
      { name: 'T2', label: 'Cover Thickness (mm)', placeholder: '1.6', step: 0.1 },
      { name: 'Collor2', label: 'Cover Flange (mm)', placeholder: '10' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '80' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '75' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' },
      { name: 'PCRate', label: 'PC Rate (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BDS = ov('Bottom DS (mm)', v.W1 + (v.H * 2) + v.P1 + v.P2 + v.P3 + (v.Collor * 2));
      const CDS = ov('Cover DS (mm)', v.W1 + (v.Collor2 * 2));
      const BW = BDS * v.T1 * 8000 / 1e6;
      const CW = CDS * v.T2 * 8000 / 1e6;
      const weight = ov('Total Weight (kg/m)', BW + CW);
      const sqft = ov('PC Area (sqft/m)', (BDS + CDS) * 2000 / 645.16 / 144);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const PCC = ov('PC Cost (Rs/m)', sqft * v.PCRate);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP + PCC);
      return {
        'Bottom DS (mm)': BDS.toFixed(1), 'Cover DS (mm)': CDS.toFixed(1),
        'PC Area (sqft/m)': sqft.toFixed(2), 'Total Weight (kg/m)': weight.toFixed(3),
        'Weight x RM (Rs/m)': WR.toFixed(2), 'PC Cost (Rs/m)': PCC.toFixed(2),
        'Total Rate (Rs/m)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  pc_ladder_welded_300: {
    sheet: 'pc', name: 'PC Welded Ladder 300 c/c', type: 'linear',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '68' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '100' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' },
      { name: 'RungPCRate', label: 'Rungs PC (Rs/sqft)', placeholder: '13' },
      { name: 'SFPCRate', label: 'SF PC (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const SF = (v.T * (v.H + 30) * 8000 / 1e6) * 2;
      const rungs = (((v.T * v.W * 60 * 8) / 1e6) * 8) / 2.5;
      const JPW = (v.H - 10) * 175 * 2 * 8 / 1e6;
      const weight = ov('Total Weight (kg/m)', SF + rungs + JPW);
      const rung_sqft = (v.W * 55 * 2 / 645.16 / 144) * 8 / 2.5;
      const sf_sqft = ((v.H + 30) * 1000 * 2 / 645.16 / 144) * 2;
      const PCC = ov('PC Charges (Rs/m)', rung_sqft * v.RungPCRate + sf_sqft * v.SFPCRate);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP + PCC);
      return {
        'Total Weight (kg/m)': weight.toFixed(3), 'Weight x RM (Rs/m)': WR.toFixed(2),
        'PC Charges (Rs/m)': PCC.toFixed(2), 'Total Rate (Rs/m)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  pc_ladder_welded_250: {
    sheet: 'pc', name: 'PC Welded Ladder 250 c/c', type: 'linear',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '68' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '100' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' },
      { name: 'RungPCRate', label: 'Rungs PC (Rs/sqft)', placeholder: '13' },
      { name: 'SFPCRate', label: 'SF PC (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const SF = (v.T * (v.H + 30) * 8000 / 1e6) * 2;
      const rungs = ((v.T * v.W * 60 * 8) / 1e6) * 4;
      const JPW = (v.H - 10) * 175 * 2 * 8 / 1e6;
      const weight = ov('Total Weight (kg/m)', SF + rungs + JPW);
      const rung_sqft = (v.W * 55 * 2 / 645.16 / 144) * 4;
      const sf_sqft = ((v.H + 30) * 1000 * 2 / 645.16 / 144) * 2;
      const PCC = ov('PC Charges (Rs/m)', rung_sqft * v.RungPCRate + sf_sqft * v.SFPCRate);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP + PCC);
      return {
        'Total Weight (kg/m)': weight.toFixed(3), 'Weight x RM (Rs/m)': WR.toFixed(2),
        'PC Charges (Rs/m)': PCC.toFixed(2), 'Total Rate (Rs/m)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  pc_ladder_boltable_300: {
    sheet: 'pc', name: 'PC Boltable Ladder 300 c/c', type: 'linear',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '66' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '90' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' },
      { name: 'BNW', label: 'Bolts/Nuts/Washers (Rs/m)', placeholder: '35' },
      { name: 'RungPCRate', label: 'Rungs PC (Rs/sqft)', placeholder: '13' },
      { name: 'SFPCRate', label: 'SF PC (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const SF = (v.T * (v.H + 50) * 8000 / 1e6) * 2;
      const rungs = (((v.T * (v.W + 50) * 60 * 8) / 1e6) * 8) / 2.5;
      const JPW = (v.H - 10) * 175 * 2 * 8 / 1e6;
      const weight = ov('Total Weight (kg/m)', SF + rungs + JPW);
      const rung_sqft = ((v.W + 50) * 55 * 2 / 645.16 / 144) * 8 / 2.5;
      const sf_sqft = ((v.H + 50) * 1000 * 2 / 645.16 / 144) * 2;
      const PCC = ov('PC Charges (Rs/m)', rung_sqft * v.RungPCRate + sf_sqft * v.SFPCRate);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP + v.BNW + PCC);
      return {
        'Total Weight (kg/m)': weight.toFixed(3), 'Weight x RM (Rs/m)': WR.toFixed(2),
        'PC Charges (Rs/m)': PCC.toFixed(2), 'Total Rate (Rs/m)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  pc_ladder_boltable_250: {
    sheet: 'pc', name: 'PC Boltable Ladder 250 c/c', type: 'linear',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '66' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '90' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' },
      { name: 'BNW', label: 'Bolts/Nuts/Washers (Rs/m)', placeholder: '35' },
      { name: 'RungPCRate', label: 'Rungs PC (Rs/sqft)', placeholder: '13' },
      { name: 'SFPCRate', label: 'SF PC (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const SF = (v.T * (v.H + 50) * 8000 / 1e6) * 2;
      const rungs = ((v.T * (v.W + 50) * 60 * 8) / 1e6) * 4;
      const JPW = (v.H - 10) * 175 * 2 * 8 / 1e6;
      const weight = ov('Total Weight (kg/m)', SF + rungs + JPW);
      const rung_sqft = ((v.W + 50) * 55 * 2 / 645.16 / 144) * 4;
      const sf_sqft = ((v.H + 50) * 1000 * 2 / 645.16 / 144) * 2;
      const PCC = ov('PC Charges (Rs/m)', rung_sqft * v.RungPCRate + sf_sqft * v.SFPCRate);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP + v.BNW + PCC);
      return {
        'Total Weight (kg/m)': weight.toFixed(3), 'Weight x RM (Rs/m)': WR.toFixed(2),
        'PC Charges (Rs/m)': PCC.toFixed(2), 'Total Rate (Rs/m)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  pc_al_raceway_cover: {
    sheet: 'pc', name: 'Aluminium Raceway with Cover', type: 'linear',
    inputs: [
      { name: 'T1', label: 'Bottom Thickness (mm)', placeholder: '1.6', step: 0.1 },
      { name: 'W1', label: 'Bottom Width (mm)', placeholder: '100' },
      { name: 'H1', label: 'Height (mm)', placeholder: '45' },
      { name: 'Collor', label: 'Bottom Side Lip (mm)', placeholder: '10' },
      { name: 'T2', label: 'Cover Thickness (mm)', placeholder: '1.6', step: 0.1 },
      { name: 'Collor2', label: 'Cover Side Flange (mm)', placeholder: '10' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '400' },
      { name: 'MFG', label: 'MFG Charges (Rs/m)', placeholder: '200' },
      { name: 'JP', label: 'JP (Rs/m)', placeholder: '10' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BDS = ov('Bottom DS (mm)', v.W1 + (v.H1 * 2) + (v.Collor * 2));
      const CDS = ov('Cover DS (mm)', v.W1 + (v.Collor2 * 2));
      const BW = ov('Bottom Wt (kg/m)', BDS * v.T1 * 3000 / 1e6);
      const CW = ov('Cover Wt (kg/m)', CDS * v.T2 * 3000 / 1e6);
      const weight = ov('Total Weight (kg/m)', BW + CW);
      const WR = ov('Weight x RM (Rs/m)', weight * v.RM);
      const total = ov('Total Rate (Rs/m)', WR + v.MFG + v.JP);
      return {
        'Bottom DS (mm)': BDS.toFixed(1), 'Cover DS (mm)': CDS.toFixed(1),
        'Bottom Wt (kg/m)': BW.toFixed(3), 'Cover Wt (kg/m)': CW.toFixed(3),
        'Total Weight (kg/m)': weight.toFixed(3), 'Weight x RM (Rs/m)': WR.toFixed(2),
        'Total Rate (Rs/m)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  pc_junction_box: {
    sheet: 'pc', name: 'PC Junction Box', type: 'piece',
    inputs: [
      { name: 'W1', label: 'Bottom Width W1 (mm)', placeholder: '150' },
      { name: 'W2', label: 'Bottom Length W2 (mm)', placeholder: '150' },
      { name: 'T', label: 'Bottom Thickness (mm)', placeholder: '1.6', step: 0.1 },
      { name: 'Cover_T', label: 'Cover Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'FDS', label: 'Flange Dev Size (mm)', placeholder: '35' },
      { name: 'Flange_T', label: 'Flange Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'SDC_Qty', label: 'Dummy Cover Qty', placeholder: '1' },
      { name: 'SDC_H', label: 'Dummy Cover Height (mm)', placeholder: '50' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '75' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '200' },
      { name: 'Leg', label: 'Leg Fab. Charges (Rs/pc)', placeholder: '60' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BW = ov('Bottom Wt (kg)', v.W1 * v.W2 * v.T * 8 / 1e6);
      const CW = ov('Cover Wt (kg)', v.W1 * v.W2 * v.Cover_T * 8 / 1e6);
      const FW = ov('Flange Wt (kg)', (v.W1 * 4) * v.FDS * v.Flange_T * 8 / 1e6);
      const SDCW = ov('Dummy Cover Wt (kg)', v.SDC_Qty * v.SDC_H * v.W1 * 8 / 1e6 * 2);
      const weight = ov('Total Weight (kg)', BW + CW + FW + SDCW);
      const base = ov('Base Cost (Rs)', weight * v.RM + v.MFG + v.Leg);
      const PCC = ov('PC Charge (30%)', base * 0.3);
      const total = ov('Total Cost (Rs/pc)', base + PCC);
      return {
        'Bottom Wt (kg)': BW.toFixed(3), 'Cover Wt (kg)': CW.toFixed(3),
        'Flange Wt (kg)': FW.toFixed(3), 'Dummy Cover Wt (kg)': SDCW.toFixed(3),
        'Total Weight (kg)': weight.toFixed(3), 'Base Cost (Rs)': base.toFixed(2),
        'PC Charge (30%)': PCC.toFixed(2), 'Total Cost (Rs/pc)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  pc_horizontal_bend_perf: {
    sheet: 'pc', name: 'PC Horizontal Bend Perforated', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '150' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '76' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '250' },
      { name: 'PCRate', label: 'PC Rate (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const DS1 = ov('Dev Size (mm)', v.W + v.H + v.R + 75);
      const weight = ov('Total Weight (kg/pc)', v.T * DS1 * DS1 * 8 / 1e6);
      const sqft = ov('PC Area (sqft)', DS1 * DS1 * 2 / 645.16 / 144);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const PCC = ov('PC Cost (Rs/pc)', sqft * v.PCRate);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG + PCC);
      return {
        'Dev Size (mm)': DS1.toFixed(1), 'PC Area (sqft)': sqft.toFixed(2),
        'Total Weight (kg/pc)': weight.toFixed(3), 'Weight x RM (Rs/pc)': WR.toFixed(2),
        'PC Cost (Rs/pc)': PCC.toFixed(2), 'Total Cost (Rs/pc)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  pc_perf_tee_bend: {
    sheet: 'pc', name: 'PC Perforated Tee Bend', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '150' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '76' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' },
      { name: 'PCRate', label: 'PC Rate (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const DS1 = ov('DS 1 (mm)', v.W + (v.R * 2) + 75 + 75);
      const DS2 = ov('DS 2 (mm)', v.W + v.R + v.H + 75);
      const weight = ov('Total Weight (kg/pc)', DS1 * DS2 * v.T * 8 / 1e6);
      const sqft = ov('PC Area (sqft)', DS1 * DS2 * 2 / 645.16 / 144);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const PCC = ov('PC Cost (Rs/pc)', sqft * v.PCRate);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG + PCC);
      return {
        'DS 1 (mm)': DS1.toFixed(1), 'DS 2 (mm)': DS2.toFixed(1),
        'PC Area (sqft)': sqft.toFixed(2), 'Total Weight (kg/pc)': weight.toFixed(3),
        'Weight x RM (Rs/pc)': WR.toFixed(2), 'PC Cost (Rs/pc)': PCC.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  pc_perf_cross_bend: {
    sheet: 'pc', name: 'PC Perforated Cross Bend', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '150' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '76' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' },
      { name: 'PCRate', label: 'PC Rate (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const DS1 = ov('Dev Size (mm)', v.W + (v.R * 2) + 75 + 75);
      const DS2 = DS1;
      const weight = ov('Total Weight (kg/pc)', DS1 * DS2 * v.T * 8 / 1e6);
      const sqft = ov('PC Area (sqft)', DS1 * DS2 * 2 / 645.16 / 144);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const PCC = ov('PC Cost (Rs/pc)', sqft * v.PCRate);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG + PCC);
      return {
        'Dev Size (mm)': DS1.toFixed(1), 'PC Area (sqft)': sqft.toFixed(2),
        'Total Weight (kg/pc)': weight.toFixed(3), 'Weight x RM (Rs/pc)': WR.toFixed(2),
        'PC Cost (Rs/pc)': PCC.toFixed(2), 'Total Cost (Rs/pc)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  pc_horizontal_bend_cover: {
    sheet: 'pc', name: 'PC Horizontal Bend with Cover', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '150' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '76' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '250' },
      { name: 'PCRate', label: 'PC Rate (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BDS = ov('Bottom DS (mm)', v.W + v.H + v.R + 75);
      const CDS = ov('Cover DS (mm)', v.W + v.H + v.R + 10);
      const BW = BDS * BDS * v.T * 8 / 1e6;
      const CW = CDS * CDS * v.T * 8 / 1e6;
      const weight = ov('Total Weight (kg/pc)', BW + CW);
      const sqft = ov('PC Area (sqft)', (BDS * BDS + CDS * CDS) * 2 / 645.16 / 144);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const PCC = ov('PC Cost (Rs/pc)', sqft * v.PCRate);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG + PCC);
      return {
        'Bottom DS (mm)': BDS.toFixed(1), 'Cover DS (mm)': CDS.toFixed(1),
        'PC Area (sqft)': sqft.toFixed(2), 'Total Weight (kg/pc)': weight.toFixed(3),
        'Weight x RM (Rs/pc)': WR.toFixed(2), 'PC Cost (Rs/pc)': PCC.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  pc_tee_bend_cover: {
    sheet: 'pc', name: 'PC Tee Bend with Cover', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '150' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '76' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' },
      { name: 'PCRate', label: 'PC Rate (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BDS1 = ov('Bottom DS 1 (mm)', v.W + (v.R * 2) + 75 + 75);
      const BDS2 = v.W + v.R + v.H + 75;
      const CDS1 = ov('Cover DS (mm)', v.W + (v.R * 2) + 10 + 10);
      const CDS2 = v.W + v.R + v.H + 10;
      const BW = BDS1 * BDS2 * v.T * 8 / 1e6;
      const CW = CDS1 * CDS2 * v.T * 8 / 1e6;
      const weight = ov('Total Weight (kg/pc)', BW + CW);
      const sqft = ov('PC Area (sqft)', (BDS1 * BDS2 + CDS1 * CDS2) * 2 / 645.16 / 144);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const PCC = ov('PC Cost (Rs/pc)', sqft * v.PCRate);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG + PCC);
      return {
        'Bottom DS 1 (mm)': BDS1.toFixed(1), 'Cover DS (mm)': CDS1.toFixed(1),
        'PC Area (sqft)': sqft.toFixed(2), 'Total Weight (kg/pc)': weight.toFixed(3),
        'Weight x RM (Rs/pc)': WR.toFixed(2), 'PC Cost (Rs/pc)': PCC.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  pc_cross_bend_cover: {
    sheet: 'pc', name: 'PC Cross Bend with Cover', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '150' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '76' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' },
      { name: 'PCRate', label: 'PC Rate (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const BDS1 = ov('Bottom DS (mm)', v.W + (v.R * 2) + 75 + 75);
      const CDS1 = v.W + (v.R * 2) + 75 + 75;
      const CDS2 = ov('Cover DS (mm)', v.W + (v.R * 2) + 10 + 10);
      const BW = BDS1 * BDS1 * v.T * 8 / 1e6;
      const CW = CDS1 * CDS2 * v.T * 8 / 1e6;
      const weight = ov('Total Weight (kg/pc)', BW + CW);
      const sqft = ov('PC Area (sqft)', (BDS1 * BDS1 + CDS1 * CDS2) * 2 / 645.16 / 144);
      const WR = ov('Weight x RM (Rs/pc)', weight * v.RM);
      const PCC = ov('PC Cost (Rs/pc)', sqft * v.PCRate);
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG + PCC);
      return {
        'Bottom DS (mm)': BDS1.toFixed(1), 'Cover DS (mm)': CDS2.toFixed(1),
        'PC Area (sqft)': sqft.toFixed(2), 'Total Weight (kg/pc)': weight.toFixed(3),
        'Weight x RM (Rs/pc)': WR.toFixed(2), 'PC Cost (Rs/pc)': PCC.toFixed(2),
        'Total Cost (Rs/pc)': total.toFixed(2), quote: Math.round(total), weight
      };
    }
  },

  pc_ladder_equal_cross: {
    sheet: 'pc', name: 'PC Ladder Equal Cross', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '300' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '110' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '1500' },
      { name: 'SFPCRate', label: 'SF PC (Rs/sqft)', placeholder: '13' },
      { name: 'RungPCRate', label: 'Rungs PC (Rs/sqft)', placeholder: '15' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const SF_DS = ov('SF DS (mm)', ((v.R * 2) * 3.14 / 4 + 200) * 4);
      const SF_Wt = ov('SF Wt (kg/pc)', SF_DS * (v.H + 30) * v.T * 8 / 1e6);
      const Rung_Wt = ov('Rungs Wt (kg/pc)', v.T * v.W * 65 * 8 / 1e6 * 10);
      const JP_Wt = 2.08 * 2;
      const weight = ov('Total Weight (kg/pc)', SF_Wt + Rung_Wt + JP_Wt);
      const sf_sqft = (v.H + 30) * SF_DS * 2 / 645.16 / 144;
      const rung_sqft = (v.W * 60 * 2 / 645.16 / 144) * 12;
      const PCC = ov('PC Cost (Rs/pc)', sf_sqft * v.SFPCRate + rung_sqft * v.RungPCRate);
      const WR = weight * v.RM;
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG + PCC);
      return {
        'SF DS (mm)': SF_DS.toFixed(1), 'SF Wt (kg/pc)': SF_Wt.toFixed(3),
        'Rungs Wt (kg/pc)': Rung_Wt.toFixed(3), 'Total Weight (kg/pc)': weight.toFixed(3),
        'PC Cost (Rs/pc)': PCC.toFixed(2), 'Total Cost (Rs/pc)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  pc_h_bend_ladder: {
    sheet: 'pc', name: 'PC H Bend Ladder', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '300' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '73' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '600' },
      { name: 'SFPCRate', label: 'SF PC (Rs/sqft)', placeholder: '15' },
      { name: 'RungPCRate', label: 'Rungs PC (Rs/sqft)', placeholder: '5' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const F = (v.W * 2) + (v.R * 2);
      const G = F * 3.14 / 4;
      const I = G + 200;
      const J = (v.R * 2) * 3.14 / 4 + 200;
      const K = ov('SF Length (mm)', I + J);
      const SF_Wt = ov('SF Wt (kg/pc)', K * v.T * (v.H + 30) * 8 / 1e6);
      const Rungs_Total = ov('Rungs Wt (kg/pc)', v.T * v.W * 75 * 8 / 1e6 * 5);
      const JP_Wt = ((v.H - 10) * 175 * 2 * 8 / 1e6) * 2;
      const weight = ov('Total Weight (kg/pc)', SF_Wt + Rungs_Total + JP_Wt);
      const sf_sqft = (v.H + 30) * K * 2 / 645.16 / 144;
      const rung_sqft = (v.W * 60 * 2 / 645.16 / 144) * 8;
      const PCC = ov('PC Cost (Rs/pc)', sf_sqft * v.SFPCRate + rung_sqft * v.RungPCRate);
      const WR = weight * v.RM;
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG + PCC);
      return {
        'SF Length (mm)': K.toFixed(1), 'SF Wt (kg/pc)': SF_Wt.toFixed(3),
        'Rungs Wt (kg/pc)': Rungs_Total.toFixed(3), 'Total Weight (kg/pc)': weight.toFixed(3),
        'PC Cost (Rs/pc)': PCC.toFixed(2), 'Total Cost (Rs/pc)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  },

  pc_ladder_equal_tee: {
    sheet: 'pc', name: 'PC Ladder Equal Tee', type: 'piece',
    inputs: [
      { name: 'T', label: 'Thickness (mm)', placeholder: '2.0', step: 0.1 },
      { name: 'W', label: 'Width (mm)', placeholder: '200' },
      { name: 'H', label: 'Height (mm)', placeholder: '100' },
      { name: 'R', label: 'Radius (mm)', placeholder: '300' },
      { name: 'RM', label: 'Raw Material Rate (Rs/kg)', placeholder: '110' },
      { name: 'MFG', label: 'MFG Charges (Rs/pc)', placeholder: '1250' },
      { name: 'SFPCRate', label: 'SF PC (Rs/sqft)', placeholder: '15' },
      { name: 'RungPCRate', label: 'Rungs PC (Rs/sqft)', placeholder: '10' }
    ],
    calculate(v, ov) {
      ov = ov || ((k, x) => x);
      const SF_DS1 = (v.R * 2) * 3.14 / 4 + 200;
      const SF_DS2 = v.W + (v.R * 2) + 200;
      const SF_DS = ov('SF DS (mm)', (SF_DS1 * 2) + SF_DS2);
      const SF_Wt = ov('SF Wt (kg/pc)', SF_DS * (v.H + 30) * v.T * 8 / 1e6);
      const Rung_Wt = ov('Rungs Wt (kg/pc)', v.T * v.W * 65 * 8 / 1e6 * 10);
      const JP_Wt = 2.08 / 4 * 6;
      const weight = ov('Total Weight (kg/pc)', SF_Wt + Rung_Wt + JP_Wt);
      const sf_sqft = (v.H + 30) * SF_DS * 2 / 645.16 / 144;
      const rung_sqft = (v.W * 60 * 2 / 645.16 / 144) * 8;
      const PCC = ov('PC Cost (Rs/pc)', sf_sqft * v.SFPCRate + rung_sqft * v.RungPCRate);
      const WR = weight * v.RM;
      const total = ov('Total Cost (Rs/pc)', WR + v.MFG + PCC);
      return {
        'SF DS (mm)': SF_DS.toFixed(1), 'SF Wt (kg/pc)': SF_Wt.toFixed(3),
        'Rungs Wt (kg/pc)': Rung_Wt.toFixed(3), 'Total Weight (kg/pc)': weight.toFixed(3),
        'PC Cost (Rs/pc)': PCC.toFixed(2), 'Total Cost (Rs/pc)': total.toFixed(2),
        quote: Math.round(total), weight
      };
    }
  }
};

// ----------------------------------------------------------------
// APP STATE
// ----------------------------------------------------------------
let activeTab = 'gi';
let workspaceItems = [];
let quoteItems = [];
let nextId = 1;

// ----------------------------------------------------------------
// MULTI-CUSTOMER SESSIONS + reload persistence
// Each session = one customer's working order (workspace + quote + name).
// Everything is saved to localStorage so a reload never loses work.
// ----------------------------------------------------------------
let sessions = [];
let activeIdx = 0;
let restoring = false;
let editedQuote = null;
try { editedQuote = JSON.parse(localStorage.getItem('fixo_edited_quote') || 'null'); } catch (e) {}

function _escTab(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function snapshotActive() {
  const cn = document.getElementById('client-name');
  const fr = document.getElementById('quote-freight');
  const da = document.getElementById('quote-deliver-addr');
  return {
    ws: JSON.parse(JSON.stringify(workspaceItems)),
    q: JSON.parse(JSON.stringify(quoteItems)),
    nid: nextId,
    client: cn ? cn.value : '',
    freight: fr ? fr.value : '',
    deliverAddr: da ? da.value : ''
  };
}
function persistSessions() {
  if (restoring) return;
  const s = sessions[activeIdx];
  if (s) { const snap = snapshotActive(); s.ws = snap.ws; s.q = snap.q; s.nid = snap.nid; s.client = snap.client; s.freight = snap.freight; s.deliverAddr = snap.deliverAddr; }
  try { localStorage.setItem('fixo_sessions', JSON.stringify({ sessions: sessions, activeIdx: activeIdx })); } catch (e) {}
}
function loadSessionData(i) {
  restoring = true;
  activeIdx = i;
  const s = sessions[i] || { ws: [], q: [], nid: 1, client: '' };
  workspaceItems = JSON.parse(JSON.stringify(s.ws || []));
  quoteItems = JSON.parse(JSON.stringify(s.q || []));
  nextId = s.nid || 1;
  const cn = document.getElementById('client-name'); if (cn) cn.value = s.client || '';
  const fr = document.getElementById('quote-freight'); if (fr) fr.value = s.freight || '';
  const da = document.getElementById('quote-deliver-addr'); if (da) da.value = s.deliverAddr || '';
  activeQuoteNo = null;
  restoring = false;
  renderWorkspace();
  renderQuotePanel();
  renderSessionTabs();
}
function newSession() {
  persistSessions();
  sessions.push({ id: Date.now(), ws: [], q: [], nid: 1, client: '' });
  loadSessionData(sessions.length - 1);
  persistSessions();
  const cn = document.getElementById('client-name'); if (cn) cn.focus();
}
function closeSession(i) {
  if (sessions.length <= 1) { sessions[0] = { id: Date.now(), ws: [], q: [], nid: 1, client: '' }; loadSessionData(0); persistSessions(); return; }
  sessions.splice(i, 1);
  loadSessionData(Math.min(i, sessions.length - 1));
  persistSessions();
}
function switchSession(i) { if (i === activeIdx) return; persistSessions(); loadSessionData(i); }
function renderSessionTabs() {
  const bar = document.getElementById('session-tabs'); if (!bar) return;
  let html = sessions.map((s, i) => {
    const label = (s.client && s.client.trim()) ? s.client.trim() : ('Order ' + (i + 1));
    const n = (i === activeIdx) ? quoteItems.length : (s.q || []).length;
    return `<div class="sess-tab ${i === activeIdx ? 'active' : ''}" data-sess="${i}" title="${_escTab(label)}">
      <span class="sess-name">${_escTab(label)}</span>${n ? `<span class="sess-count">${n}</span>` : ''}
      ${sessions.length > 1 ? `<button class="sess-close" data-close="${i}" title="Close">&times;</button>` : ''}
    </div>`;
  }).join('');
  html += `<button class="sess-add" id="sess-add" title="New customer order">+ New Order</button>`;
  bar.innerHTML = html;
  bar.querySelectorAll('[data-sess]').forEach(t => t.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) return; switchSession(+t.dataset.sess); }));
  bar.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); closeSession(+b.dataset.close); }));
  const add = document.getElementById('sess-add'); if (add) add.addEventListener('click', newSession);
}
function initSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem('fixo_sessions') || 'null');
    if (saved && Array.isArray(saved.sessions) && saved.sessions.length) {
      sessions = saved.sessions;
      activeIdx = Math.min(saved.activeIdx || 0, sessions.length - 1);
      loadSessionData(activeIdx);
      return;
    }
  } catch (e) {}
  sessions = [{ id: Date.now(), ws: [], q: [], nid: 1, client: '' }];
  activeIdx = 0;
  loadSessionData(0);
}

// ----------------------------------------------------------------
// INIT
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const tgi = document.getElementById('tab-gi'); if (tgi) tgi.addEventListener('click', () => switchTab('gi'));
  const tpc = document.getElementById('tab-pc'); if (tpc) tpc.addEventListener('click', () => switchTab('pc'));

  const compBox = document.querySelector('.component-box');
  const dropdown = document.getElementById('component-dropdown');
  const ddSearch = document.getElementById('dropdown-search');

  compBox.addEventListener('click', (e) => {
    if (e.target.closest('.component-dropdown')) return;
    compBox.classList.toggle('open');
    dropdown.classList.toggle('show');
    if (dropdown.classList.contains('show')) {
      ddSearch.value = '';
      ddSearch.focus();
      renderDropdown('');
    }
  });

  ddSearch.addEventListener('input', () => renderDropdown(ddSearch.value));
  ddSearch.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('click', (e) => {
    if (!compBox.contains(e.target)) {
      compBox.classList.remove('open');
      dropdown.classList.remove('show');
    }
  });

  document.getElementById('btn-whatsapp').addEventListener('click', openWhatsAppModal);
  document.getElementById('btn-email').addEventListener('click', openEmailModal);
  document.getElementById('btn-whatsapp-appr').addEventListener('click', openWhatsAppModal);
  document.getElementById('btn-email-appr').addEventListener('click', openEmailModal);
  document.getElementById('btn-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-print-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-approval-pdf').addEventListener('click', () => downloadPDF('approval'));
  document.getElementById('btn-download-pdf').addEventListener('click', () => downloadPDF('final'));
  document.getElementById('btn-download-txt').addEventListener('click', downloadTXT);

  document.getElementById('wa-modal-close').addEventListener('click', closeWAModal);
  document.getElementById('wa-cancel').addEventListener('click', closeWAModal);
  document.getElementById('wa-send').addEventListener('click', sendWhatsApp);

  document.getElementById('email-modal-close').addEventListener('click', closeEmailModal);
  document.getElementById('email-cancel').addEventListener('click', closeEmailModal);
  document.getElementById('email-send').addEventListener('click', sendEmail);

  setupQuoteDragDrop();
  renderMatBar();
  syncSectionToMaterial();
  initSessions();
  const cn = document.getElementById('client-name');
  if (cn) cn.addEventListener('input', () => { if (!restoring) { persistSessions(); renderSessionTabs(); } });
  ['quote-freight', 'quote-deliver-addr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { if (!restoring) persistSessions(); });
  });
  const svBtn = document.getElementById('btn-save-order');
  if (svBtn) svBtn.addEventListener('click', saveCurrentOrder);
  const opBtn = document.getElementById('btn-open-order');
  if (opBtn) opBtn.addEventListener('click', openSavedOrders);
  window.addEventListener('beforeunload', persistSessions);
  setInterval(() => { if (!restoring) persistSessions(); }, 1500); // autosave (reload-safe)
});

// ----------------------------------------------------------------
// SAVED ORDERS — explicit save + reopen-to-re-edit (survives new orders/reload)
// ----------------------------------------------------------------
function loadSavedOrders() { try { return JSON.parse(localStorage.getItem('fixo_saved_orders') || '[]'); } catch (e) { return []; } }
function storeSavedOrders(a) { try { localStorage.setItem('fixo_saved_orders', JSON.stringify(a)); } catch (e) {} }
function saveCurrentOrder() {
  if (!quoteItems.length) { toast('Add items to the quote first'); return; }
  const client = ((document.getElementById('client-name') || {}).value || '').trim() || 'Unnamed';
  const fr = document.getElementById('quote-freight'), da = document.getElementById('quote-deliver-addr');
  const orders = loadSavedOrders();
  const rec = {
    id: 'so-' + Date.now(), client, savedAt: new Date().toLocaleString('en-IN'),
    q: JSON.parse(JSON.stringify(quoteItems)),
    freight: fr ? fr.value : '', deliverAddr: da ? da.value : '',
    editedQuote: (window.FIXO && FIXO.getEditedQuote) ? FIXO.getEditedQuote() : null
  };
  orders.unshift(rec); storeSavedOrders(orders);
  toast('Order saved — ' + client + ' (reopen from “Saved Orders”)');
}
function reopenSavedOrder(id) {
  const rec = loadSavedOrders().find(o => o.id === id); if (!rec) return;
  if (typeof newSession === 'function') newSession();   // don't clobber current work
  quoteItems = JSON.parse(JSON.stringify(rec.q || []));
  const cn = document.getElementById('client-name'); if (cn) cn.value = rec.client || '';
  const fr = document.getElementById('quote-freight'); if (fr) fr.value = rec.freight || '';
  const da = document.getElementById('quote-deliver-addr'); if (da) da.value = rec.deliverAddr || '';
  if (rec.editedQuote && window.FIXO && FIXO.setEditedQuote) FIXO.setEditedQuote(rec.editedQuote);
  renderQuotePanel();
  if (typeof persistSessions === 'function') persistSessions();
  toast('Reopened ' + (rec.client || 'order') + ' — edit and re-print');
}
function openSavedOrders() {
  const orders = loadSavedOrders();
  let modal = document.getElementById('saved-orders-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'saved-orders-modal'; modal.className = 'modal-overlay'; document.body.appendChild(modal); }
  const rows = orders.length
    ? orders.map(o => `<div class="so-row"><div class="so-info"><b>${_escTab(o.client)}</b><span>${_escTab(o.savedAt)} · ${(o.q || []).length} item(s)</span></div><div class="so-btns"><button class="btn-export so-open" data-id="${o.id}">Re-edit</button><button class="so-del" data-id="${o.id}" title="Delete">&times;</button></div></div>`).join('')
    : '<div class="so-empty">No saved orders yet. Build a quote and click “Save Order”.</div>';
  modal.innerHTML = `<div class="modal-dialog" style="max-width:540px"><div class="modal-header"><div class="modal-title-group"><h3>Saved Orders</h3></div><button class="modal-close-btn" id="so-x">&times;</button></div><div class="modal-body" id="so-list">${rows}</div></div>`;
  modal.classList.add('show');
  modal.querySelector('#so-x').onclick = () => modal.classList.remove('show');
  modal.querySelectorAll('.so-open').forEach(b => b.onclick = () => { reopenSavedOrder(b.dataset.id); modal.classList.remove('show'); });
  modal.querySelectorAll('.so-del').forEach(b => b.onclick = () => { storeSavedOrders(loadSavedOrders().filter(o => o.id !== b.dataset.id)); openSavedOrders(); });
}

function switchTab(tab) {
  activeTab = tab;
  const gi = document.getElementById('tab-gi'), pc = document.getElementById('tab-pc');
  if (gi) gi.classList.toggle('active', tab === 'gi');
  if (pc) pc.classList.toggle('active', tab === 'pc');
}
// The product section (gi vs pc) is now driven by the chosen finish:
// Powder Coated → PC sheet/logic, everything else → GI sheet/logic.
function syncSectionToMaterial() {
  activeTab = isPowder() ? 'pc' : 'gi';
  const dd = document.getElementById('dropdown-list');
  if (dd && typeof renderDropdown === 'function') renderDropdown((document.getElementById('dropdown-search') || {}).value || '');
}

// ----------------------------------------------------------------
// DROPDOWN
// ----------------------------------------------------------------
function renderDropdown(search) {
  const list = document.getElementById('dropdown-list');
  const s = search.toLowerCase();
  list.innerHTML = '';
  const keys = Object.keys(PRODUCTS_DB).filter(k => {
    const p = PRODUCTS_DB[k];
    return p.sheet === activeTab && p.name.toLowerCase().includes(s);
  });
  if (keys.length === 0) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">No products found</div>';
    return;
  }
  keys.forEach(key => {
    const p = PRODUCTS_DB[key];
    const el = document.createElement('div');
    el.className = 'dropdown-item';
    el.innerHTML = `<span class="dropdown-item-name">${p.name}</span><span class="dropdown-item-tag ${p.type}">${p.type === 'linear' ? 'Per Meter' : 'Per Piece'}</span>`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelector('.component-box').classList.remove('open');
      document.getElementById('component-dropdown').classList.remove('show');
      askProductQuantity(key);
    });
    list.appendChild(el);
  });
}

// ----------------------------------------------------------------
// WORKSPACE
// ----------------------------------------------------------------
function addToWorkspace(key, qty) {
  const p = PRODUCTS_DB[key];
  const inputs = {};
  p.inputs.forEach(inp => { inputs[inp.name] = 0; });
  const q = (qty == null || isNaN(parseFloat(qty))) ? 1 : Math.max(0, parseFloat(qty));
  workspaceItems.push({ id: nextId++, productKey: key, inputs, qty: q, overrides: {} });
  renderWorkspace();
  const ws = document.getElementById('workspace');
  setTimeout(() => ws.scrollTo({ top: ws.scrollHeight, behavior: 'smooth' }), 50);
}

// Pop-up asking how many of a product to add, so the user sets the quantity
// once at add-time instead of scrolling up to search & add repeatedly.
// ----------------------------------------------------------------
// MATERIAL / FINISH / GSM selector — tags every quote line so the
// diversification (e.g. "MS Hot Dip", "GI Powder Coated 120GSM") shows on the
// quotation PDF and flows to Proforma & Factory. Powder-coated adds the
// sq-ft coating charge (verified from the worksheet: sqft × rate).
// ----------------------------------------------------------------
const MATERIALS = {
  'GI': { finishes: ['GI', 'Powder Coated'], gsm: true },
  'MS': { finishes: ['Plain', 'Hot Dip', 'Powder Coated'] },
  'Stainless Steel': { finishes: ['SS 202', 'SS 304', 'SS 316'] },
  'Aluminium': { finishes: ['Commercial Grade', 'Marine Grade'] }
};
const GSM_OPTS = ['—', '80', '120', '180', '200', '275'];
let finishCfg = { material: 'GI', finish: 'GI', gsm: '—', pcRate: 15 };
try { const s = JSON.parse(localStorage.getItem('fixo_finish_cfg') || 'null'); if (s) finishCfg = Object.assign(finishCfg, s); } catch (e) {}
function saveFinishCfg() { try { localStorage.setItem('fixo_finish_cfg', JSON.stringify(finishCfg)); } catch (e) {} }
function isPowder() { return /powder/i.test(finishCfg.finish); }
function finishLabel() {
  const m = finishCfg.material, f = finishCfg.finish, g = finishCfg.gsm;
  let out = m;
  if (f && f !== m && f !== 'Plain' && f !== 'GI') out += ' ' + f;
  else if (f === 'Plain') out += ' Plain';
  if (m === 'GI' && g && g !== '—') out += ' ' + g + 'GSM';
  return out;
}
function powderChargeFor(inputs) {
  const W = parseFloat(inputs.W || inputs.W1) || 0;
  const H = parseFloat(inputs.H) || 0;
  const col = parseFloat(inputs.Collor || inputs.Limb) || 0;
  if (!W) return 0;
  const DS = W + 2 * H + 2 * col;              // development size (mm)
  const sqft = ((DS * 2000) / 645.16) / 144;   // per worksheet: mm² → in² → ft²
  return Math.round(sqft * (parseFloat(finishCfg.pcRate) || 0));
}
function renderMatBar() {
  const bar = document.getElementById('mat-bar'); if (!bar) return;
  const mat = MATERIALS[finishCfg.material] || MATERIALS.GI;
  if (!mat.finishes.includes(finishCfg.finish)) finishCfg.finish = mat.finishes[0];
  bar.innerHTML = `
    <span class="mat-lab">Step 1 · Material</span>
    <select id="mat-material">${Object.keys(MATERIALS).map(m => `<option ${m === finishCfg.material ? 'selected' : ''}>${m}</option>`).join('')}</select>
    <select id="mat-finish">${mat.finishes.map(f => `<option ${f === finishCfg.finish ? 'selected' : ''}>${f}</option>`).join('')}</select>
    ${mat.gsm ? `<select id="mat-gsm" title="GSM">${GSM_OPTS.map(g => `<option ${g === finishCfg.gsm ? 'selected' : ''}>${g === '—' ? '— GSM' : g + ' GSM'}</option>`).join('')}</select>` : ''}
    ${isPowder() ? `<label class="mat-pc">Coat ₹/sqft <input type="number" id="mat-pcrate" min="0" step="1" value="${finishCfg.pcRate}"></label>` : ''}
    <span class="mat-tag">${_escTab(finishLabel())}</span>`;
  bar.querySelector('#mat-material').onchange = e => { finishCfg.material = e.target.value; const mm = MATERIALS[finishCfg.material]; finishCfg.finish = mm.finishes[0]; if (!mm.gsm) finishCfg.gsm = '—'; saveFinishCfg(); renderMatBar(); syncSectionToMaterial(); };
  bar.querySelector('#mat-finish').onchange = e => { finishCfg.finish = e.target.value; saveFinishCfg(); renderMatBar(); syncSectionToMaterial(); };
  const gs = bar.querySelector('#mat-gsm'); if (gs) gs.onchange = e => { finishCfg.gsm = e.target.value.replace(' GSM', '').replace('— ', '—'); saveFinishCfg(); renderMatBar(); };
  const pr = bar.querySelector('#mat-pcrate'); if (pr) pr.onchange = e => { finishCfg.pcRate = parseFloat(e.target.value) || 0; saveFinishCfg(); };
}

function askProductQuantity(key) {
  const p = PRODUCTS_DB[key];
  let modal = document.getElementById('qty-ask-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'qty-ask-modal'; modal.className = 'modal-overlay'; document.body.appendChild(modal); }
  modal.innerHTML = `
    <div class="modal-dialog" style="max-width:420px">
      <div class="modal-header"><div class="modal-title-group"><h3>Add ${_escTab(p.name)}</h3></div><button class="modal-close-btn" id="qa-x">&times;</button></div>
      <div class="modal-body">
        <label class="qa-label">How many to add?</label>
        <input type="number" id="qa-input" min="1" step="1" value="1" class="qa-input">
        <p class="qa-hint">This adds that many cards — one per size/variant of this product (e.g. the same tray in 4 different sizes). Enter the dimensions and meters/qty on each card afterwards.</p>
      </div>
      <div class="modal-actions vf-actions">
        <button class="btn-cancel" id="qa-cancel">Cancel</button>
        <button class="btn-send" id="qa-add">Add</button>
      </div>
    </div>`;
  modal.classList.add('show');
  const inp = document.getElementById('qa-input');
  setTimeout(() => { inp.focus(); inp.select(); }, 30);
  const close = () => modal.classList.remove('show');
  const confirm = () => { close(); const n = Math.max(1, Math.min(50, parseInt(inp.value) || 1)); for (let i = 0; i < n; i++) addToWorkspace(key); };
  document.getElementById('qa-x').onclick = close;
  document.getElementById('qa-cancel').onclick = close;
  document.getElementById('qa-add').onclick = confirm;
  inp.onkeydown = (e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') close(); };
}

// Cost cell text: when qty is 0 the line is "rate only" — show the per-unit
// rate (so it never looks like ₹0) and make clear the quantity is hidden.
function costCellHtml(qty, eff) {
  const q = parseFloat(qty) || 0;
  if (!q) return '₹' + Number(eff.quote || 0).toLocaleString('en-IN') + ' <small class="rate-only">/unit · qty hidden</small>';
  return '₹' + (eff.quote * q).toLocaleString('en-IN');
}

function renderWorkspace() {
  const container = document.getElementById('workspace-cards');
  const ws = document.getElementById('workspace');
  if (workspaceItems.length === 0) {
    ws.classList.remove('has-cards');
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
      <p>Workspace is empty</p>
      <p class="empty-hint">Select a component from the dropdown above to begin</p>
    </div>`;
    return;
  }
  ws.classList.add('has-cards');
  container.innerHTML = '';
  workspaceItems.forEach(item => {
    const p = PRODUCTS_DB[item.productKey];
    const base = p.calculate(item.inputs);                       // un-overridden reference
    const out = p.calculate(item.inputs, mkOv(item.overrides));  // cascaded with overrides
    const eff = getEffectiveQuoteAndWeight(out);
    const totalCost = eff.quote * item.qty;
    const totalWt = (eff.weight * item.qty).toFixed(3);
    let inputsHtml = '';
    p.inputs.forEach(inp => {
      const step = inp.step ? `step="${inp.step}"` : '';
      const val = item.inputs[inp.name] === 0 ? '' : item.inputs[inp.name];
      inputsHtml += `<div class="field"><label>${inp.label}</label><input type="number" value="${val}" placeholder="${inp.placeholder || ''}" ${step} data-id="${item.id}" data-field="${inp.name}" class="calc-input"></div>`;
    });
    let bdHtml = '';
    Object.keys(out).forEach(k => {
      if (k !== 'quote' && k !== 'weight') {
        const emphasis = isOverridableKey(k);
        const isOverridden = item.overrides.hasOwnProperty(k);
        const displayVal = out[k];
        const editBtn = `<button class="bd-edit-btn" data-bd-id="${item.id}" data-bd-key="${k}" data-bd-orig="${base[k]}" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button>`;
        bdHtml += `<div class="bd-row${emphasis ? ' editable' : ''}"><span class="bd-label">${k}</span><span class="bd-val${isOverridden ? ' overridden' : ''}"><span class="bd-text">${displayVal}</span>${editBtn}</span></div>`;
      }
    });
    const card = document.createElement('div');
    card.className = `calc-card ${p.sheet}-card`;
    card.dataset.instanceId = item.id;
    card.innerHTML = `
      <div class="card-top">
        <div class="card-top-left">
          <span class="card-sheet-tag">${_escTab(finishLabel())}</span>
          <span class="card-name">${p.name}</span>
        </div>
        <button class="card-remove-btn" data-remove="${item.id}" title="Remove">&times;</button>
      </div>
      <div class="card-body">
        <div class="card-inputs">
          <div class="section-label">Design Parameters</div>
          <div class="inputs-grid">${inputsHtml}</div>
        </div>
        <div class="card-breakdown">
          <div class="section-label">Calculation Details</div>
          <div class="breakdown-table">${bdHtml}</div>
        </div>
      </div>
      <div class="card-footer">
        <div class="footer-left">
          <div class="qty-group">
            <label>${p.type === 'linear' ? 'Meters' : 'Quantity'}</label>
            <input type="number" value="${item.qty}" min="0" data-qty="${item.id}" class="qty-input">
          </div>
        </div>
        <div class="footer-right">
          <div class="metric-box">
            <span class="metric-label">Weight</span>
            <span class="metric-value" data-wt="${item.id}">${totalWt} kg</span>
          </div>
          <div class="metric-box highlight">
            <span class="metric-label">Total Cost</span>
            <span class="metric-value" data-cost="${item.id}">${costCellHtml(item.qty, eff)}</span>
          </div>
          <button class="btn-add-quote" data-addquote="${item.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Add to Quote
          </button>
        </div>
      </div>`;
    container.appendChild(card);
  });

  container.querySelectorAll('.calc-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const id = parseInt(e.target.dataset.id);
      const field = e.target.dataset.field;
      const item = workspaceItems.find(i => i.id === id);
      if (!item) return;
      item.inputs[field] = parseFloat(e.target.value) || 0;
      updateCardDisplay(item);
    });
  });
  container.querySelectorAll('.qty-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const id = parseInt(e.target.dataset.qty);
      const item = workspaceItems.find(i => i.id === id);
      if (!item) return;
      item.qty = Math.max(0, parseInt(e.target.value) || 0);
      updateCardDisplay(item);
    });
  });
  container.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.closest('[data-remove]').dataset.remove);
      workspaceItems = workspaceItems.filter(i => i.id !== id);
      renderWorkspace();
    });
  });
  container.querySelectorAll('[data-addquote]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.closest('[data-addquote]').dataset.addquote);
      addToQuote(id);
    });
  });
  container.querySelectorAll('.bd-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const el = e.target.closest('.bd-edit-btn');
      const id = parseInt(el.dataset.bdId);
      const key = el.dataset.bdKey;
      const orig = el.dataset.bdOrig;
      const item = workspaceItems.find(i => i.id === id);
      if (!item) return;
      const valSpan = el.parentElement;
      const textSpan = valSpan.querySelector('.bd-text');
      const currentVal = item.overrides.hasOwnProperty(key) ? item.overrides[key] : orig;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'bd-edit-input';
      inp.value = currentVal;
      textSpan.replaceWith(inp);
      el.style.display = 'none';
      inp.focus();
      inp.select();
      const commit = () => {
        const newVal = inp.value.trim();
        if (newVal !== '' && newVal !== orig) {
          item.overrides[key] = newVal;
        } else {
          delete item.overrides[key];
        }
        updateCardDisplay(item);
      };
      inp.addEventListener('blur', commit);
      inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { delete item.overrides[key]; inp.blur(); } });
    });
  });
}

// The "total" output lines get extra visual emphasis, but EVERY breakdown
// line is editable — an override on any line cascades through the formula.
function isOverridableKey(k) {
  const s = k.toLowerCase();
  return s.includes('total rate') || s.includes('total cost') || s.includes('total weight');
}

// Build an override function threaded into calculate(): for any breakdown
// line the user has overridden, substitute the user's numeric value so all
// downstream values (and the final weight / quote) recompute from it.
function mkOv(overrides) {
  return (key, computed) => {
    if (overrides && overrides.hasOwnProperty(key)) {
      const parsed = parseFloat(String(overrides[key]).replace(/[^0-9.\-]/g, ''));
      if (!isNaN(parsed)) return parsed;
    }
    return computed;
  };
}

// calculate() (called with mkOv) already bakes overrides into quote/weight.
function getEffectiveQuoteAndWeight(out) {
  return { quote: out.quote, weight: out.weight };
}

function updateCardDisplay(item) {
  const p = PRODUCTS_DB[item.productKey];
  const base = p.calculate(item.inputs);
  const out = p.calculate(item.inputs, mkOv(item.overrides));
  const eff = getEffectiveQuoteAndWeight(out);
  const totalCost = eff.quote * item.qty;
  const totalWt = (eff.weight * item.qty).toFixed(3);
  const card = document.querySelector(`[data-instance-id="${item.id}"]`);
  if (!card) return;
  const bd = card.querySelector('.breakdown-table');
  let bdHtml = '';
  Object.keys(out).forEach(k => {
    if (k !== 'quote' && k !== 'weight') {
      const emphasis = isOverridableKey(k);
      const isOverridden = item.overrides && item.overrides.hasOwnProperty(k);
      const displayVal = out[k];
      const editBtn = `<button class="bd-edit-btn" data-bd-id="${item.id}" data-bd-key="${k}" data-bd-orig="${base[k]}" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button>`;
      bdHtml += `<div class="bd-row${emphasis ? ' editable' : ''}"><span class="bd-label">${k}</span><span class="bd-val${isOverridden ? ' overridden' : ''}"><span class="bd-text">${displayVal}</span>${editBtn}</span></div>`;
    }
  });
  bd.innerHTML = bdHtml;
  // Re-attach edit listeners for this card
  bd.querySelectorAll('.bd-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const el = e.target.closest('.bd-edit-btn');
      const key = el.dataset.bdKey;
      const orig = el.dataset.bdOrig;
      const valSpan = el.parentElement;
      const textSpan = valSpan.querySelector('.bd-text');
      const currentVal = item.overrides && item.overrides.hasOwnProperty(key) ? item.overrides[key] : orig;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'bd-edit-input';
      inp.value = currentVal;
      textSpan.replaceWith(inp);
      el.style.display = 'none';
      inp.focus();
      inp.select();
      const commit = () => {
        const newVal = inp.value.trim();
        if (newVal !== '' && newVal !== orig) {
          item.overrides[key] = newVal;
        } else {
          delete item.overrides[key];
        }
        updateCardDisplay(item);
      };
      inp.addEventListener('blur', commit);
      inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { delete item.overrides[key]; inp.blur(); } });
    });
  });
  const wtEl = card.querySelector(`[data-wt="${item.id}"]`);
  const costEl = card.querySelector(`[data-cost="${item.id}"]`);
  if (wtEl) wtEl.textContent = `${totalWt} kg`;
  if (costEl) costEl.innerHTML = costCellHtml(item.qty, eff);
}

// ----------------------------------------------------------------
// QUOTE PANEL
// ----------------------------------------------------------------
function addToQuote(instanceId) {
  const wsItem = workspaceItems.find(i => i.id === instanceId);
  if (!wsItem) return;
  const p = PRODUCTS_DB[wsItem.productKey];
  const out = p.calculate(wsItem.inputs, mkOv(wsItem.overrides));
  const eff = getEffectiveQuoteAndWeight(out);
  // Powder coating adds the sq-ft coating charge on top of the computed rate.
  const pcCharge = isPowder() ? powderChargeFor(wsItem.inputs) : 0;
  const rate = eff.quote + pcCharge;
  quoteItems.push({
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    productKey: wsItem.productKey, name: p.name, sheet: p.sheet, type: p.type,
    finish: finishLabel(), finishCfg: JSON.parse(JSON.stringify(finishCfg)), pcCharge: pcCharge,
    inputs: JSON.parse(JSON.stringify(wsItem.inputs)), qty: wsItem.qty,
    quoteRate: rate, unitWeight: eff.weight,
    totalCost: rate * wsItem.qty, totalWeight: eff.weight * wsItem.qty, breakdown: out,
    overrides: JSON.parse(JSON.stringify(wsItem.overrides || {}))
  });

  // Remove from workspace after adding to cart
  workspaceItems = workspaceItems.filter(i => i.id !== instanceId);
  renderWorkspace();
  renderQuotePanel();
  toast(`${p.name} added to quote`);
}

function renderQuotePanel() {
  if (typeof renderSessionTabs === 'function') renderSessionTabs();
  const list = document.getElementById('quote-items-list');
  const badge = document.getElementById('quote-badge');
  const amount = document.getElementById('valuation-amount');
  let totalCost = 0, totalWt = 0;
  quoteItems.forEach(i => { totalCost += i.totalCost; totalWt += i.totalWeight; });
  badge.textContent = quoteItems.length;
  amount.textContent = `₹${totalCost.toLocaleString('en-IN')}`;
  if (quoteItems.length === 0) {
    activeQuoteNo = null; // fresh quote → new number next time
    list.innerHTML = `<div class="quote-empty">
      <div class="quote-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      No items yet.<br>Add products from the workspace.
    </div>`;
    return;
  }
  list.innerHTML = '';
  quoteItems.forEach(item => {
    const details = [];
    if (item.inputs.T || item.inputs.T1) details.push(`T:${item.inputs.T || item.inputs.T1}`);
    if (item.inputs.W || item.inputs.W1) details.push(`W:${item.inputs.W || item.inputs.W1}`);
    if (item.inputs.H || item.inputs.H1) details.push(`H:${item.inputs.H || item.inputs.H1}`);
    const unit = item.type === 'linear' ? 'mtr' : 'pcs';
    const el = document.createElement('div');
    el.className = `quote-item ${item.sheet}`;
    el.setAttribute('draggable', 'true');
    el.dataset.qid = item.id;
    el.innerHTML = `<span class="qi-drag" title="Drag back to the workspace to edit">⠿</span><span class="qi-name">${item.name}</span>
      <button class="qi-edit" data-qedit="${item.id}" title="Edit — move back to workspace">✎</button>
      <button class="qi-remove" data-qremove="${item.id}">&times;</button>
      <div class="qi-details">${details.join(' | ')}</div>
      <div class="qi-edit-row">
        <div class="qi-field"><label>Qty (${unit})</label><input type="number" min="0" step="1" value="${item.qty}" data-qqty="${item.id}" class="qi-input"></div>
        <div class="qi-field"><label>Rate ₹</label><input type="number" min="0" step="0.01" value="${item.quoteRate}" data-qrate="${item.id}" class="qi-input"></div>
      </div>
      <div class="qi-bottom"><span class="qi-qty">${item.qty ? 'Amount' : 'Rate only'}</span><span class="qi-cost">${item.qty ? '₹' + item.totalCost.toLocaleString('en-IN') : '₹' + Number(item.quoteRate || 0).toLocaleString('en-IN') + ' /unit'}</span></div>`;
    el.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/fixo-qid', String(item.id));
      ev.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    list.appendChild(el);
  });
  const refreshItem = (item, el) => {
    item.totalCost = Math.round(item.quoteRate * item.qty);
    item.totalWeight = item.unitWeight * item.qty;
    const costEl = el.querySelector('.qi-cost');
    const lblEl = el.querySelector('.qi-qty');
    if (costEl) costEl.textContent = item.qty ? `₹${item.totalCost.toLocaleString('en-IN')}` : `₹${Number(item.quoteRate || 0).toLocaleString('en-IN')} /unit`;
    if (lblEl) lblEl.textContent = item.qty ? 'Amount' : 'Rate only';
    updateQuoteValuation();
  };
  list.querySelectorAll('[data-qqty]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const item = quoteItems.find(i => i.id === e.target.dataset.qqty);
      if (!item) return;
      item.qty = Math.max(0, parseInt(e.target.value) || 0);
      refreshItem(item, e.target.closest('.quote-item'));
    });
  });
  list.querySelectorAll('[data-qrate]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const item = quoteItems.find(i => i.id === e.target.dataset.qrate);
      if (!item) return;
      const v = parseFloat(e.target.value);
      item.quoteRate = isNaN(v) ? 0 : v;
      refreshItem(item, e.target.closest('.quote-item'));
    });
  });
  list.querySelectorAll('[data-qedit]').forEach(btn => {
    btn.addEventListener('click', () => moveQuoteItemToWorkspace(btn.dataset.qedit));
  });
  list.querySelectorAll('[data-qremove]').forEach(btn => {
    btn.addEventListener('click', () => {
      quoteItems = quoteItems.filter(i => i.id !== btn.dataset.qremove);
      renderQuotePanel();
    });
  });
}

// Move an item from the quote back into the workspace for full editing.
// Preserves any sidebar-set rate as an override so nothing is lost.
function moveQuoteItemToWorkspace(id) {
  const item = quoteItems.find(i => i.id === id);
  if (!item) return;
  const overrides = JSON.parse(JSON.stringify(item.overrides || {}));
  try {
    const base = PRODUCTS_DB[item.productKey].calculate(item.inputs);
    const rateKey = Object.keys(base).find(k => {
      const s = k.toLowerCase();
      return s.includes('total rate') || s.includes('total cost');
    });
    if (rateKey && item.quoteRate != null && Math.round(item.quoteRate) !== Math.round(base.quote)) {
      overrides[rateKey] = String(item.quoteRate);
    }
  } catch (e) { /* keep existing overrides */ }
  workspaceItems.push({
    id: nextId++,
    productKey: item.productKey,
    inputs: JSON.parse(JSON.stringify(item.inputs || {})),
    qty: item.qty || 1,
    overrides
  });
  quoteItems = quoteItems.filter(i => i.id !== id);
  renderWorkspace();
  renderQuotePanel();
  const ws = document.getElementById('workspace');
  if (ws) setTimeout(() => ws.scrollTo({ top: ws.scrollHeight, behavior: 'smooth' }), 60);
  toast('Moved back to workspace — edit, then “Add to Quote” again');
}

// Allow dragging a quote item onto the workspace to move it back for editing.
function setupQuoteDragDrop() {
  const ws = document.getElementById('workspace');
  if (!ws || ws.dataset.dropWired) return;
  ws.dataset.dropWired = '1';
  const accepts = (dt) => {
    const t = dt ? Array.from(dt.types) : [];
    return t.includes('text/fixo-qid') || t.includes('application/fixo-order-items');
  };
  ws.addEventListener('dragover', (ev) => {
    if (accepts(ev.dataTransfer)) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      ws.classList.add('drop-target');
    }
  });
  ws.addEventListener('dragleave', (ev) => { if (ev.target === ws) ws.classList.remove('drop-target'); });
  ws.addEventListener('drop', (ev) => {
    const qid = ev.dataTransfer.getData('text/fixo-qid');
    const orderItems = ev.dataTransfer.getData('application/fixo-order-items');
    if (!qid && !orderItems) return;
    ev.preventDefault();
    ws.classList.remove('drop-target');
    if (qid) { moveQuoteItemToWorkspace(qid); return; }
    try {
      const items = JSON.parse(orderItems);
      const n = window.FIXO.loadOrderItems(items);
      toast(n ? (n + ' item(s) loaded into workspace') : 'This order has no re-editable items');
    } catch (e) { /* ignore */ }
  });
}

function updateQuoteValuation() {
  let totalCost = 0, totalWt = 0;
  quoteItems.forEach(i => { totalCost += i.totalCost; totalWt += i.totalWeight; });
  const amount = document.getElementById('valuation-amount');
  if (amount) amount.textContent = `₹${totalCost.toLocaleString('en-IN')}`;
  const badge = document.getElementById('quote-badge');
  if (badge) badge.textContent = quoteItems.length;
}

// ----------------------------------------------------------------
// SHARED: Quotation header/footer constants
// ----------------------------------------------------------------
const COMPANY_NAME = 'FIXOTECH ENGINEERING SYSTEMS Pvt Ltd';
const COMPANY_ADDRESS = 'No. 4 & 5 / 12 & 13 J.P.R Building Gurunanjudaiah Industrial Area, Abbigere, Chikkabanavara, Bangalore -90';
const COMPANY_CONTACT = 'Ph : 9632060011, 9900032639 Email : sales@fixotech.in fixotech@rediffmail.com Website : www.fixotechcabletrays.in';
const TERMS_CONDITIONS = [
  'HSN Code :- 73089090',
  'VALIDITY - 01 DAY',
  'AFTER VALIDITY PRICES WILL BE SUBJECT TO MARKET PRICE',
  'STANDARD LENGTH OF THE CABLE TRAY 2500mm',
  'PRICES OF SUPPORTS AND  ACCESSORIES WILL BE EXTRA',
  'TRANSPORTATION CHARGES EXTRA FROM OUR OFFICE TO YOUR SITE'
];
const TERMS_DETAIL = [
  { label: 'Taxes', value: 'Duties & Taxes Extra As applicable - (18% GST)', style: 'normal' },
  { label: 'Delivery Charges', value: 'Packing & Delivery charges extra at actuals.', style: 'normal' },
  { label: 'Unloading', value: 'In your scope', style: 'red' },
  { label: 'Payments', value: '50% Advance and balance 50% before despatch', style: 'bold' }
];
const FOOTER_NOTE = 'Note : "PRINTED FROM THE ONLINE SYSTEMS ARE CONSIDERED UNCONTROLLED"';

// A sequential quotation number, stable for the current quote (all exports of
// the same quote share one number); a fresh number is issued for a new quote.
let activeQuoteNo = null;
function getQtnNo() {
  if (activeQuoteNo) return activeQuoteNo;
  const now = new Date();
  const fy1 = now.getMonth() >= 3 ? now.getFullYear() % 100 : (now.getFullYear() - 1) % 100;
  const fy2 = fy1 + 1;
  const seq = parseInt(localStorage.getItem('fixo_qtn_seq') || '0', 10) + 1;
  localStorage.setItem('fixo_qtn_seq', String(seq));
  activeQuoteNo = 'FESPL/QTN/' + fy1 + '-' + fy2 + '/' + String(seq).padStart(4, '0');
  return activeQuoteNo;
}

function fileSlug(s) {
  return String(s || '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'Quote';
}
function quoteFileName(kind, ext, client) {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return 'Fixotech_' + kind + '_' + fileSlug(client) + '_' + fileSlug(getQtnNo()) + '_' + d + '.' + ext;
}

// Record an exported/printed quotation against the selected client (if any).
function recordExport(kind) {
  try {
    if (window.FIXO && typeof window.FIXO.onExport === 'function' && quoteItems.length) {
      window.FIXO.onExport({ kind, qtnNo: getQtnNo(), client: window.FIXO.getClientName(), snapshot: window.FIXO.getQuoteSnapshot() });
    }
  } catch (e) { /* non-fatal */ }
}

function fmtINR(n) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Editable data model that drives BOTH the PDF and Excel outputs and the
// Verify window. Built from the current quote; the Verify window may edit it.
// Signature of the current quote's line-item SET (ids) — used to tell whether a
// saved edit still belongs to the quote on screen.
function currentQuoteSig() {
  return quoteItems.map(i => i.id).slice().sort().join(',');
}

// buildQuoteModel overlaid with the last saved edits (if they belong to this
// quote). This is the single source of truth for every output — PDF editor,
// final print, approval, Excel — so an edit made once shows up everywhere.
function mergedQuoteModel() {
  const m = buildQuoteModel();
  const eq = (window.FIXO && FIXO.getEditedQuote) ? FIXO.getEditedQuote() : null;
  if (eq && Array.isArray(eq.items) && eq.items.length) {
    if (eq.client && eq.client !== 'N/A') m.client = eq.client;
    m.items = eq.items.map((it, i) => ({ sl: i + 1, desc: it.desc, unit: it.unit, qty: it.qty, rate: it.rate, amount: it.amount }));
    m.total = eq.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    if (eq.freight != null) m.freight = eq.freight;
    if (eq.deliverAddr) m.deliverAddr = eq.deliverAddr;
  }
  return m;
}

function buildQuoteModel() {
  const client = ((document.getElementById('client-name') || {}).value || '').trim() || 'N/A';
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const items = quoteItems.map((i, idx) => ({
    sl: idx + 1,
    desc: getQuoteDescription(i),
    finish: i.finish || '',
    unit: i.type === 'linear' ? 'Mtr' : 'Nos',
    qty: i.qty,
    rate: i.quoteRate,
    amount: i.totalCost
  }));
  let total = 0; items.forEach(it => total += it.amount);
  const frEl = document.getElementById('quote-freight');
  const daEl = document.getElementById('quote-deliver-addr');
  const freight = frEl ? (parseFloat(String(frEl.value).replace(/[^0-9.\-]/g, '')) || 0) : 0;
  return {
    client, date, qtnNo: getQtnNo(),
    mktg: 'MKTG / R / 03', enquiryRef: '', dt: '', source: '', amended: '', dated: '',
    items, total,
    freight, deliverAddr: daEl ? daEl.value.trim() : '',
    images: {} // { logo, cert, seal, watermark } base64 overrides set by Verify window
  };
}

function getQuoteDescription(item) {
  // Prefix the material/finish diversification so it shows on the PDF and flows downstream.
  const fin = (item.finish && item.finish !== 'GI') ? item.finish + ' ' : '';
  const parts = [fin + item.name];
  const dims = [];
  if (item.inputs.T || item.inputs.T1) dims.push('T:' + (item.inputs.T || item.inputs.T1) + 'mm');
  if (item.inputs.W || item.inputs.W1) dims.push('W:' + (item.inputs.W || item.inputs.W1) + 'mm');
  if (item.inputs.H || item.inputs.H1) dims.push('H:' + (item.inputs.H || item.inputs.H1) + 'mm');
  if (dims.length) parts.push(dims.join(' x '));
  return parts.join('\n');
}

// ----------------------------------------------------------------
// EXPORT: TXT (Fixotech Quotation Format)
// ----------------------------------------------------------------
function downloadTXT() {
  if (quoteItems.length === 0) { toast('Add items to quote first'); return; }
  const client = document.getElementById('client-name').value.trim() || 'N/A';
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const line = '='.repeat(90);
  const div = '-'.repeat(90);
  const qtnNo = getQtnNo();

  let txt = '\n' + line + '\n';
  txt += '  ' + COMPANY_NAME + '\n';
  txt += '  ISO 9001 : 2015 CERTIFIED CO\n';
  txt += '  ' + COMPANY_ADDRESS + '\n';
  txt += '  ' + COMPANY_CONTACT + '\n';
  txt += line + '\n';
  txt += '                                  QUOTATION\n';
  txt += line + '\n';
  txt += '  QTN No. ' + qtnNo + '                        QTN Date : ' + date + '\n';
  txt += '                                                MKTG / R / 03\n';
  txt += '  To\n';
  txt += '  M/s  ' + client + '\n';
  txt += div + '\n\n';

  txt += padCol('SL.NO', 8) + padCol('DESCRIPTION', 42) + padCol('UNIT', 8) + padCol('QTY', 8) + padCol('RATES', 14) + 'AMOUNT\n';
  txt += div + '\n';
  txt += padCol('', 8) + 'MAKE :- FIXOTECH\n\n';

  let tc = 0;
  quoteItems.forEach((item, i) => {
    tc += item.totalCost;
    const desc = item.name + ' (' + item.sheet.toUpperCase() + ')';
    const unit = item.type === 'linear' ? 'Mtr' : 'Nos';
    txt += padCol(String(i + 1), 8) + padCol(desc, 42) + padCol(unit, 8) + padCol(String(item.qty), 8) + padCol(fmtINR(item.quoteRate), 14) + fmtINR(item.totalCost) + '\n';
  });

  txt += div + '\n';
  txt += padCol('', 58) + padCol('TOTAL', 8) + padCol('', 14) + fmtINR(tc) + '\n';
  txt += padCol('', 58) + 'FREIGHT       EXTRA\n';
  txt += padCol('', 58) + 'GST\n';
  txt += div + '\n\n';

  TERMS_CONDITIONS.forEach(t => { txt += '  * ' + t + '\n'; });
  txt += '\n  Terms & Conditions\n';
  txt += '  ' + div.substring(0, 70) + '\n';
  TERMS_DETAIL.forEach(td => { txt += '  ' + padCol(td.label, 22) + ':  ' + td.value + '\n'; });
  txt += '  Note: Prices are subject to change depends upon the changes in the sheet rates prevailing\n';
  txt += '\n  Yours Truly,\n  For ' + COMPANY_NAME + '\n\n\n\n  Authorised Signatory\n';
  txt += '  ' + FOOTER_NOTE + '\n';
  txt += line + '\n';

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Fixotech_Quote_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('TXT slip downloaded');
}

function padCol(str, width) { return (str + ' '.repeat(width)).substring(0, width); }

// ----------------------------------------------------------------
// EXPORT: CSV (Fixotech Quotation Format — matches Excel template layout)
// ----------------------------------------------------------------
function exportCSV(opts) {
  opts = (opts && opts.returnBlob) ? opts : {};
  if (quoteItems.length === 0) { if (!opts.returnBlob) toast('Add items to quote first'); return null; }
  const client = document.getElementById('client-name').value.trim() || 'N/A';
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const qtnNo = getQtnNo();
  const e = v => '"' + String(v).replace(/"/g, '""') + '"';

  let csv = '﻿';
  csv += ',' + e(COMPANY_NAME) + ',,,,,\n';
  csv += ',' + e('ISO 9001 : 2015 CERTIFIED CO') + ',,,,,\n';
  csv += e(COMPANY_ADDRESS) + ',,,,,,\n';
  csv += e(COMPANY_CONTACT) + ',,,,,,\n';
  csv += '\n';
  csv += ',,,' + e('QUOTATION') + ',,,\n';
  csv += '\n';
  csv += e('QTN No. ' + qtnNo) + ',,,' + e('QTN Date :') + ',' + e(date) + ',,\n';
  csv += ',,,,,,' + e('MKTG / R / 03') + '\n';
  csv += e('To') + ',,,,' + e('ENQUIRY REF :') + ',,\n';
  csv += e('M/s') + ',' + e(client) + ',,,,' + e('SOURCE :-') + ',\n';
  csv += '\n';
  csv += e('SL.NO') + ',' + e('DESCRIPTION') + ',' + e('UNIT') + ',' + e('QTY') + ',' + e('RATES') + ',' + e('AMOUNT') + ',\n';
  csv += ',' + e('MAKE :- FIXOTECH') + ',,,,,\n';

  let tc = 0;
  quoteItems.forEach((item, i) => {
    tc += item.totalCost;
    const desc = item.name + ' (' + item.sheet.toUpperCase() + ')';
    const unit = item.type === 'linear' ? 'Mtr' : 'Nos';
    csv += e(i + 1) + ',' + e(desc) + ',' + e(unit) + ',' + e(item.qty) + ',' + item.quoteRate.toFixed(2) + ',' + item.totalCost.toFixed(2) + ',\n';
  });

  csv += '\n';
  csv += ',,,,,' + e('TOTAL') + ',' + tc.toFixed(2) + '\n';
  csv += ',,,,,' + e('FREIGHT') + ',' + e('EXTRA') + '\n';
  csv += ',,,,,' + e('GST') + ',\n';
  csv += '\n';
  TERMS_CONDITIONS.forEach(t => { csv += e(t) + ',,,,,,\n'; });
  csv += '\n';
  csv += e('Terms & Conditions') + ',,,,,,\n';
  TERMS_DETAIL.forEach(td => { csv += e(td.label) + ',,' + e(': ' + td.value) + ',,,,\n'; });
  csv += e('Note: Prices are subject to change depends upon the changes in the sheet rates prevailing') + ',,,,,,\n';
  csv += '\n';
  csv += e('Yours Truly,') + ',,,,,,\n';
  csv += e('For ' + COMPANY_NAME) + ',,,,,,\n';
  csv += ',,,,,,\n';
  csv += e('Authorised Signatory') + ',,,,,,\n';
  csv += e(FOOTER_NOTE) + ',,,,,,\n';

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const filename = quoteFileName('Quotation', 'csv', client);
  if (opts.returnBlob) return { blob, filename };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  recordExport('CSV Quotation');
  toast('CSV exported');
}

// ----------------------------------------------------------------
// EXPORT: styled Excel (.xlsx) — mirrors the PDF quotation (colours,
// logo, cert mark, seal, table). CSV can't hold formatting/images, so
// the "Excel" output is a real .xlsx.
// ----------------------------------------------------------------
async function exportXlsx(model) {
  if (typeof ExcelJS === 'undefined') { toast('Excel engine not loaded'); return; }
  const M = model || buildQuoteModel();
  if (!M.items || !M.items.length) { toast('Add items to quote first'); return; }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Quotation', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 } }
  });
  ws.columns = [{ width: 8 }, { width: 46 }, { width: 9 }, { width: 9 }, { width: 15 }, { width: 16 }];

  const thin = { style: 'thin', color: { argb: 'FF000000' } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };
  const set = (addr, val, o) => {
    o = o || {};
    const c = ws.getCell(addr);
    c.value = val;
    c.font = { name: 'Arial', size: o.size || 10, bold: !!o.bold, color: { argb: o.color || 'FF000000' } };
    c.alignment = { vertical: 'middle', horizontal: o.align || 'left', wrapText: !!o.wrap };
    if (o.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } };
    if (o.border !== false) c.border = box;
    return c;
  };
  const b64 = (d) => (d && d.indexOf(',') >= 0) ? d.split(',')[1] : d;
  // Resolve a product picture (respecting user replacements) to base64 for
  // embedding. Uses an <img> + canvas rather than fetch() so it also works when
  // the app is opened from a file:// path (fetch is blocked there, which is why
  // Excel images weren't loading).
  const fetchImgB64 = (url) => new Promise((resolve) => {
    try {
      if (!url) return resolve(null);
      if (url.indexOf('data:') === 0) {
        let ex = (url.match(/data:image\/(\w+)/) || [])[1] || 'png'; if (ex === 'jpg') ex = 'jpeg';
        return resolve({ b64: url.split(',')[1], ext: ex });
      }
      const im = new Image();
      im.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = im.naturalWidth || 300; c.height = im.naturalHeight || 300;
          c.getContext('2d').drawImage(im, 0, 0);
          resolve({ b64: c.toDataURL('image/png').split(',')[1], ext: 'png' });
        } catch (e) { resolve(null); }
      };
      im.onerror = () => resolve(null);
      im.src = url;
    } catch (e) { resolve(null); }
  });
  const imgOf = (k, glob) => (M.images && M.images[k]) || (typeof glob !== 'undefined' ? glob : null);
  const logoData = imgOf('logo', typeof LOGO_IMG !== 'undefined' ? LOGO_IMG : undefined);
  const certData = imgOf('cert', typeof CERT_IMG !== 'undefined' ? CERT_IMG : undefined);
  const sealData = imgOf('seal', typeof SEAL_IMG !== 'undefined' ? SEAL_IMG : undefined);

  // ---- Header band (logo + cert) ----
  ws.getRow(1).height = 20; ws.getRow(2).height = 20; ws.getRow(3).height = 20;
  ws.mergeCells('A1:D3'); ws.mergeCells('E1:F3');
  ['A1', 'E1'].forEach(a => { ws.getCell(a).border = box; });
  try {
    if (logoData) { const id = wb.addImage({ base64: b64(logoData), extension: 'png' }); ws.addImage(id, { tl: { col: 0.15, row: 0.15 }, br: { col: 3.0, row: 2.85 } }); }
    if (certData) { const id2 = wb.addImage({ base64: b64(certData), extension: 'png' }); ws.addImage(id2, { tl: { col: 4.15, row: 0.15 }, br: { col: 5.85, row: 2.85 } }); }
  } catch (e) { /* image optional */ }

  ws.mergeCells('A4:F4'); set('A4', 'ISO 9001 : 2015 CERTIFIED COMPANY', { bold: true, align: 'center', size: 9 });
  ws.mergeCells('A5:F5'); set('A5', COMPANY_ADDRESS, { align: 'center', size: 8 });
  ws.mergeCells('A6:F6'); set('A6', COMPANY_CONTACT, { align: 'center', size: 8 });
  ws.mergeCells('A7:F7'); set('A7', 'QUOTATION', { bold: true, align: 'center', size: 14 });
  let r = 8;
  const isDraft = false; // Excel mirrors the final layout; draft banner not needed for spreadsheets
  // ---- Reference grid ----
  const refRow = (a, b, c, opts) => {
    ws.mergeCells('A' + r + ':B' + r); ws.mergeCells('C' + r + ':D' + r); ws.mergeCells('E' + r + ':F' + r);
    set('A' + r, a, { bold: true, size: 9, color: (opts && opts.redA) ? 'FF990000' : 'FF000000' });
    set('C' + r, b, { bold: true, size: 9 });
    set('E' + r, c, { bold: true, size: 9, align: (opts && opts.centerC) ? 'center' : 'left' });
    r++;
  };
  refRow('QTN No. ' + M.qtnNo, 'QTN Date :-  ' + M.date, M.mktg || 'MKTG / R / 03', { centerC: true });
  refRow('To', 'ENQUIRY REF :-  ' + (M.enquiryRef || ''), 'Dt :-  ' + (M.dt || ''));
  refRow('M/s  ' + M.client, 'SOURCE :-  ' + (M.source || ''), 'AMENDED', { redA: true, centerC: true });
  refRow('', '', 'DATED', { centerC: true });

  // ---- Product table header ----
  const hdr = ['SL.NO', 'DESCRIPTION', 'UNIT', 'QTY', 'RATES', 'AMOUNT'];
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col, i) => set(col + r, hdr[i], { bold: true, align: 'center', size: 9 }));
  r++;
  ws.mergeCells('A' + r + ':F' + r); set('A' + r, '   MAKE :- FIXOTECH', { bold: true, size: 11, fill: 'FFDBE5F1' }); r++;

  for (let i = 0; i < M.items.length; i++) {
    const it = M.items[i];
    // Product picture (same resolver + user replacements as the PDF) embedded
    // at the left of the description, with the text indented clear of it.
    let picUrl = '';
    try { if (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.guessUrl) picUrl = FIXO_PRODUCT_IMG.guessUrl(it.desc); } catch (e) {}
    let pic = null;
    if (picUrl) pic = await fetchImgB64(picUrl);
    const zeroQ = !parseFloat(String(it.qty).replace(/[^0-9.\-]/g, ''));  // rate-only line
    set('A' + r, it.sl != null ? it.sl : i + 1, { align: 'center', size: 9 });
    set('B' + r, String(it.desc || '').replace(/\n/g, ' — '), { size: 9, wrap: true });
    if (pic) {
      ws.getRow(r).height = 46;
      ws.getCell('B' + r).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 22 };
      try {
        const id = wb.addImage({ base64: pic.b64, extension: pic.ext });
        ws.addImage(id, { tl: { col: 1.04, row: (r - 1) + 0.08 }, br: { col: 1.5, row: (r - 1) + 0.94 }, editAs: 'oneCell' });
      } catch (e) {}
    }
    set('C' + r, zeroQ ? '' : (it.unit || ''), { align: 'center', size: 9 });
    set('D' + r, zeroQ ? '' : it.qty, { align: 'center', size: 9 });
    set('E' + r, Number(it.rate), { align: 'right', size: 9 }); ws.getCell('E' + r).numFmt = '#,##0.00';
    if (zeroQ) { set('F' + r, '', { align: 'right', size: 9, bold: true }); }
    else { set('F' + r, Number(it.amount), { align: 'right', size: 9, bold: true }); ws.getCell('F' + r).numFmt = '#,##0.00'; }
    r++;
  }

  // ---- Totals ----
  const tRow = r;
  ws.mergeCells('A' + tRow + ':D' + (tRow + 2));
  set('A' + tRow, '', {});
  set('E' + tRow, 'TOTAL', { bold: true, align: 'right', size: 9 });
  set('F' + tRow, Number(M.total), { bold: true, align: 'right', size: 9 }); ws.getCell('F' + tRow).numFmt = '#,##0.00';
  set('E' + (tRow + 1), 'FREIGHT', { bold: true, align: 'right', size: 9 });
  set('E' + (tRow + 2), 'GST', { bold: true, align: 'right', size: 9 });
  if (Number(M.freight) > 0) {
    set('F' + (tRow + 1), Number(M.freight), { bold: true, align: 'right', size: 9 }); ws.getCell('F' + (tRow + 1)).numFmt = '#,##0.00';
    set('F' + (tRow + 2), 'EXTRA', { bold: true, align: 'center', size: 9 });
  } else {
    ws.mergeCells('F' + (tRow + 1) + ':F' + (tRow + 2)); set('F' + (tRow + 1), 'EXTRA', { bold: true, align: 'center', size: 9 });
  }
  r = tRow + 3;

  // ---- HSN + yellow terms ----
  const terms = (typeof TERMS_CONDITIONS !== 'undefined') ? TERMS_CONDITIONS : [];
  terms.forEach((t, i) => {
    ws.mergeCells('A' + r + ':F' + r);
    set('A' + r, '  ' + t, { bold: true, size: 9, fill: i === 0 ? 'FFADE1EA' : 'FFFFFF00' });
    r++;
  });

  // ---- Terms & Conditions ----
  ws.mergeCells('A' + r + ':F' + r); set('A' + r, '  Terms  & Conditions', { bold: true, size: 10 }); r++;
  const td = (typeof TERMS_DETAIL !== 'undefined') ? TERMS_DETAIL : [];
  td.forEach(d => {
    ws.mergeCells('A' + r + ':B' + r); ws.mergeCells('C' + r + ':F' + r);
    set('A' + r, d.label, { bold: true, size: 9, color: d.style === 'red' ? 'FFCC0000' : 'FF000000' });
    set('C' + r, ':  ' + d.value, { bold: d.style === 'bold', size: 9, color: d.style === 'red' ? 'FFCC0000' : 'FF000000' });
    r++;
  });
  ws.mergeCells('A' + r + ':F' + r); set('A' + r, 'Note: Prices are subject to change depends upon the changes in the sheet rates prevailing', { size: 8 }); r++;

  // ---- Signature + seal ----
  const sigTop = r;
  ws.mergeCells('A' + sigTop + ':D' + (sigTop + 4));
  ws.mergeCells('E' + sigTop + ':F' + (sigTop + 4));
  set('A' + sigTop, '', {}); set('E' + sigTop, '', {});
  set('A' + sigTop, 'Yours Truly,\nFor ' + COMPANY_NAME + '\n\n\nAuthorised Signatory', { bold: true, size: 9, wrap: true });
  ws.getCell('A' + sigTop).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  for (let k = 0; k < 5; k++) ws.getRow(sigTop + k).height = 15;
  try {
    if (sealData) { const id3 = wb.addImage({ base64: b64(sealData), extension: 'png' }); ws.addImage(id3, { tl: { col: 0.1, row: sigTop + 0.9 }, br: { col: 1.1, row: sigTop + 3.6 } }); }
  } catch (e) {}
  r = sigTop + 5;

  ws.mergeCells('A' + r + ':F' + r);
  set('A' + r, (typeof FOOTER_NOTE !== 'undefined' ? FOOTER_NOTE : ''), { bold: true, align: 'center', size: 9, color: 'FFCC0000' });

  // ---- Download ----
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = quoteFileName('Quotation', 'xlsx', M.client);
  if (model && model.__returnBlob) return { blob, filename };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  recordExport('Excel Quotation');
  toast('Excel (.xlsx) saved');
}

// ----------------------------------------------------------------
// EXPORT: PDF (Fixotech Quotation Format — exact match to company template)
// ----------------------------------------------------------------
function getPaperSize() {
  const sel = document.getElementById('paper-size');
  return sel ? sel.value : 'a4';
}

function downloadPDF(mode, opts) {
  opts = opts || {};
  mode = mode === 'approval' ? 'approval' : 'final';
  const isDraft = mode === 'approval';
  const M = opts.model || buildQuoteModel();
  if (!M.items || M.items.length === 0) { if (!opts.returnBlob) toast('Add items to quote first'); return null; }
  const client = M.client || 'N/A';
  const date = M.date || '';
  const qtnNo = M.qtnNo || '';
  const paper = getPaperSize();
  const logoImg = (M.images && M.images.logo) || (typeof LOGO_IMG !== 'undefined' ? LOGO_IMG : null);
  const certImg = (M.images && M.images.cert) || (typeof CERT_IMG !== 'undefined' ? CERT_IMG : null);
  const sealImg = (M.images && M.images.seal) || (typeof SEAL_IMG !== 'undefined' ? SEAL_IMG : null);
  const wmImg   = (M.images && M.images.watermark) || (typeof WATERMARK_IMG !== 'undefined' ? WATERMARK_IMG : null);

  if (typeof window.jspdf === 'undefined') { if (!opts.returnBlob) downloadPDFFallback(client, date, mode, paper); return null; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', paper);
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mL = 10, mR = 10;
  const cw = pw - mL - mR;
  const tc = M.total || 0;

  // Diagonal DRAFT / FOR APPROVAL stamp (approval copy only)
  function addDraftStamp() {
    if (!isDraft) return;
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.13 }));
    doc.setTextColor(200, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(pw * 0.28);
    doc.text('FOR APPROVAL', pw / 2, ph / 2, { align: 'center', angle: 32 });
    doc.restoreGraphicsState();
    doc.setTextColor(0, 0, 0);
  }

  // --- Soft watermark, centred on the table body (official-print look) ---
  function addWatermark(cx, cy, size, op) {
    if (!wmImg) return;
    try {
      const s = size || 80;
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: op || 0.05 }));
      doc.addImage(wmImg, 'PNG', cx - s / 2, cy - s / 2, s, s);
      doc.restoreGraphicsState();
    } catch (e) {}
  }

  // Column geometry (product table + shared grid). Base sums to 190mm (A4);
  // scale proportionally so it fits any selected paper width.
  const wScale = cw / 190;
  const colW = [14, 82, 16, 16, 30, 32].map(w => w * wScale);
  const xSL   = mL;
  const xDESC = xSL + colW[0];
  const xUNIT = xDESC + colW[1];
  const xQTY  = xUNIT + colW[2];
  const xRATE = xQTY + colW[3];
  const xAMT  = xRATE + colW[4];
  const rateW = colW[4], amtW = colW[5];

  doc.setDrawColor(0, 0, 0);

  // Helper: draw a bordered cell with text
  function cell(x, cy, w, h, txt, opt) {
    opt = opt || {};
    if (opt.fill) { doc.setFillColor(opt.fill[0], opt.fill[1], opt.fill[2]); doc.rect(x, cy, w, h, 'FD'); }
    else doc.rect(x, cy, w, h);
    if (txt !== '' && txt != null) {
      doc.setFont('helvetica', opt.bold ? 'bold' : 'normal');
      doc.setFontSize(opt.size || 9);
      doc.setTextColor(opt.color ? opt.color[0] : 0, opt.color ? opt.color[1] : 0, opt.color ? opt.color[2] : 0);
      const halign = opt.align || 'left';
      const pad = 1.6;
      let tx = x + pad;
      if (halign === 'center') tx = x + w / 2;
      else if (halign === 'right') tx = x + w - pad;
      const ty = cy + h / 2 + (opt.size ? opt.size : 9) * 0.13;
      doc.text(String(txt), tx, ty, { align: halign, baseline: 'middle' });
      doc.setTextColor(0, 0, 0);
    }
  }

  // ======================= HEADER BOX =======================
  let y = 8;
  const headTop = y;
  const certW = 42 * wScale;              // right certification box width
  const logoAreaW = cw - certW;
  const headH = 22;
  doc.setLineWidth(0.4);
  doc.rect(mL, headTop, logoAreaW, headH);           // logo box
  doc.rect(mL + logoAreaW, headTop, certW, headH);   // cert box
  try {
    if (logoImg) {
      const logoW = 90 * wScale, logoH = 12 * wScale;
      doc.addImage(logoImg, 'PNG', mL + (logoAreaW - logoW) / 2, headTop + 2, logoW, logoH);
    }
    if (certImg)
      doc.addImage(certImg, 'PNG', mL + logoAreaW + 2, headTop + 2, certW - 4, 18 * wScale);
  } catch (e) {}
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('ISO 9001 : 2015 CERTIFIED COMPANY', mL + logoAreaW / 2, headTop + 18, { align: 'center' });
  y = headTop + headH;

  // Address & contact (bordered rows, full width)
  cell(mL, y, cw, 5, COMPANY_ADDRESS, { align: 'center', size: 7.5 }); y += 5;
  cell(mL, y, cw, 5, COMPANY_CONTACT, { align: 'center', size: 7.5 }); y += 5;

  // QUOTATION title row (+ DRAFT sub-banner on approval copy)
  cell(mL, y, cw, 7, 'QUOTATION', { align: 'center', bold: true, size: 13 }); y += 7;
  if (isDraft) {
    cell(mL, y, cw, 5, 'FOR APPROVAL  —  DRAFT (NOT A FINAL QUOTE)',
      { align: 'center', bold: true, size: 8.5, color: [200, 0, 0], fill: [255, 235, 235] });
    y += 5;
  }

  // ======================= REFERENCE GRID =======================
  // 3 columns: A (left), B (mid), C (right)
  const rcAw = 96 * wScale, rcBw = 52 * wScale, rcCw = cw - rcAw - rcBw;
  const rcAx = mL, rcBx = mL + rcAw, rcCx = mL + rcAw + rcBw;
  const rrh = 6;
  // Row 1
  cell(rcAx, y, rcAw, rrh, 'QTN No. ' + qtnNo, { bold: true, size: 9 });
  cell(rcBx, y, rcBw, rrh, 'QTN Date :-  ' + date, { bold: true, size: 9 });
  cell(rcCx, y, rcCw, rrh, M.mktg || 'MKTG / R / 03', { align: 'center', bold: true, size: 9 });
  y += rrh;
  // Row 2
  cell(rcAx, y, rcAw, rrh, 'To', { bold: true, size: 9 });
  cell(rcBx, y, rcBw, rrh, 'ENQUIRY REF :-  ' + (M.enquiryRef || ''), { bold: true, size: 9 });
  cell(rcCx, y, rcCw, rrh, 'Dt :-  ' + (M.dt || ''), { bold: true, size: 9 });
  y += rrh;
  // Row 3 (M/s + SOURCE + AMENDED)
  cell(rcAx, y, rcAw, rrh, 'M/s  ' + client, { bold: true, size: 9, color: [153, 0, 0] });
  cell(rcBx, y, rcBw, rrh, 'SOURCE :-  ' + (M.source || ''), { bold: true, size: 9 });
  cell(rcCx, y, rcCw, rrh, 'AMENDED' + (M.amended ? '  ' + M.amended : ''), { align: 'center', bold: true, size: 8 });
  y += rrh;
  // Row 4 (DATED under AMENDED)
  cell(rcAx, y, rcAw, rrh, '', {});
  cell(rcBx, y, rcBw, rrh, '', {});
  cell(rcCx, y, rcCw, rrh, 'DATED' + (M.dated ? '  ' + M.dated : ''), { align: 'center', bold: true, size: 8 });
  y += rrh;

  // ======================= PRODUCT TABLE =======================
  // Header row
  const thh = 7;
  cell(xSL,   y, colW[0], thh, 'SL.NO',       { align: 'center', bold: true, size: 9 });
  cell(xDESC, y, colW[1], thh, 'DESCRIPTION', { align: 'center', bold: true, size: 9 });
  cell(xUNIT, y, colW[2], thh, 'UNIT',        { align: 'center', bold: true, size: 9 });
  cell(xQTY,  y, colW[3], thh, 'QTY',         { align: 'center', bold: true, size: 9 });
  cell(xRATE, y, colW[4], thh, 'RATES',       { align: 'center', bold: true, size: 9 });
  cell(xAMT,  y, colW[5], thh, 'AMOUNT',      { align: 'center', bold: true, size: 9 });
  y += thh;

  function ensureSpace(need) {
    if (y + need > ph - 12) { doc.addPage(); y = 12; }
  }

  // MAKE :- FIXOTECH banner row (light blue)
  cell(xSL, y, cw, 6, '', {});
  cell(xSL, y, cw, 6, '   MAKE :- FIXOTECH', { bold: true, size: 10, fill: [219, 229, 241] });
  y += 6;

  // Faint F-mark watermark behind the table body (drawn before rows so it sits behind)
  addWatermark(pw / 2, y + 30, 82, 0.16);

  // Product rows (from the editable model)
  doc.setLineWidth(0.4);
  M.items.forEach((it, i) => {
    const descLines = doc.splitTextToSize(String(it.desc || it.name || ''), colW[1] - 3);
    const rowH = Math.max(7, descLines.length * 4 + 2);
    ensureSpace(rowH + 30);
    cell(xSL,   y, colW[0], rowH, String(it.sl != null ? it.sl : i + 1), { align: 'center', size: 9 });
    cell(xDESC, y, colW[1], rowH, '', {});
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    doc.text(descLines, xDESC + 1.6, y + 3.4);
    cell(xUNIT, y, colW[2], rowH, it.unit || '', { align: 'center', size: 9 });
    cell(xQTY,  y, colW[3], rowH, String(it.qty), { align: 'center', size: 9 });
    cell(xRATE, y, colW[4], rowH, fmtINR(it.rate), { align: 'right', size: 9 });
    cell(xAMT,  y, colW[5], rowH, fmtINR(it.amount), { align: 'right', size: 9 });
    y += rowH;
  });

  // Spacer body row for visual balance
  ensureSpace(36);
  cell(xSL, y, colW[0], 6, '', {});
  cell(xDESC, y, colW[1], 6, '', {});
  cell(xUNIT, y, colW[2], 6, '', {});
  cell(xQTY, y, colW[3], 6, '', {});
  cell(xRATE, y, colW[4], 6, '', {});
  cell(xAMT, y, colW[5], 6, '', {});
  y += 6;

  // ======================= TOTAL / FREIGHT / GST =======================
  const leftW = colW[0] + colW[1] + colW[2] + colW[3];
  const rowTot = 7;
  // Blank left block spanning 3 rows
  cell(xSL, y, leftW, rowTot * 3, '', {});
  // TOTAL
  cell(xRATE, y, rateW, rowTot, 'TOTAL', { align: 'right', bold: true, size: 9 });
  cell(xAMT,  y, amtW, rowTot, fmtINR(tc), { align: 'right', bold: true, size: 9 });
  // FREIGHT
  cell(xRATE, y + rowTot, rateW, rowTot, 'FREIGHT', { align: 'right', bold: true, size: 9 });
  // GST
  cell(xRATE, y + rowTot * 2, rateW, rowTot, 'GST', { align: 'right', bold: true, size: 9 });
  // EXTRA merged over FREIGHT+GST
  cell(xAMT, y + rowTot, amtW, rowTot * 2, 'EXTRA', { align: 'center', bold: true, size: 9 });
  y += rowTot * 3;

  // ======================= HSN + YELLOW TERMS =======================
  const hsn = TERMS_CONDITIONS[0];
  const yellowTerms = TERMS_CONDITIONS.slice(1);
  ensureSpace(8);
  cell(mL, y, cw, 6, '  ' + hsn, { bold: true, size: 9, fill: [173, 216, 230] }); // cyan HSN
  y += 6;
  yellowTerms.forEach(t => {
    ensureSpace(8);
    cell(mL, y, cw, 6, '  ' + t, { bold: true, size: 9, fill: [255, 255, 0] });
    y += 6;
  });

  // ======================= TERMS & CONDITIONS =======================
  ensureSpace(10);
  cell(mL, y, cw, 6, '  Terms  & Conditions', { bold: true, size: 10 });
  y += 6;
  TERMS_DETAIL.forEach(td => {
    ensureSpace(7);
    const isRed = td.style === 'red';
    doc.rect(mL, y, cw, 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(isRed ? 255 : 0, 0, 0);
    doc.text(td.label, mL + 2, y + 4);
    doc.text(':', mL + 44, y + 4);
    doc.setFont('helvetica', td.style === 'bold' ? 'bold' : 'normal');
    doc.text(td.value, mL + 48, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 6;
  });
  ensureSpace(6);
  cell(mL, y, cw, 5, 'Note: Prices are subject to change depends upon the changes in the sheet rates prevailing', { size: 7.5 });
  y += 5;

  // ======================= SIGNATURE BLOCK =======================
  ensureSpace(34);
  const sigH = 34;
  const sigLeftW = cw * 0.6;
  doc.rect(mL, y, sigLeftW, sigH);            // left signature box
  doc.rect(mL + sigLeftW, y, cw - sigLeftW, sigH); // right blank box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Yours Truly,', mL + 2, y + 5);
  doc.text('For ' + COMPANY_NAME, mL + 2, y + 10);
  try {
    if (sealImg) doc.addImage(sealImg, 'PNG', mL + 2, y + 12, 20, 18);
  } catch (e) {}
  doc.text('Authorised Signatory', mL + 2, y + sigH - 2);
  y += sigH;

  // ======================= RED FOOTER NOTE =======================
  ensureSpace(6);
  doc.rect(mL, y, cw, 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 0, 0);
  doc.text(FOOTER_NOTE, pw / 2, y + 4, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 6;

  // Diagonal DRAFT stamp on top (approval copy only)
  addDraftStamp();

  const fname = quoteFileName(isDraft ? 'Quotation_DRAFT' : 'Quotation', 'pdf', client);
  if (opts.returnBlob) return { blob: doc.output('blob'), filename: fname };
  doc.save(fname);
  if (!isDraft) recordExport('PDF Quotation');
  toast(isDraft ? 'Approval copy (DRAFT) saved' : 'Quotation PDF saved');
}

// Build the full quotation as an HTML document from an editable model.
// `editable` makes the content click-to-edit (used by the PDF Verify editor);
// print output is this exact HTML, so any edit is reflected.
function buildQuoteHtml(model, opts) {
  opts = opts || {};
  const isDraft = !!opts.isDraft;
  const editable = !!opts.editable;
  const paperCss = ({ a4: 'A4', a5: 'A5', legal: 'legal', letter: 'letter' })[opts.paper || getPaperSize()] || 'A4';
  const M = model || buildQuoteModel();
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const thumb = (txt) => (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.slotHtml)
    ? FIXO_PRODUCT_IMG.slotHtml(txt, 'qthumb') : '';
  // Qty 0 (or blank) = a rate-only reference line: show the RATE but leave QTY
  // and AMOUNT blank so it isn't counted or shown as a quantity.
  const qtyZero = (q) => { const n = parseFloat(String(q).replace(/[^0-9.\-]/g, '')); return !n; };
  let rows = '';
  M.items.forEach((it, i) => {
    let desc = esc(String(it.desc || '')).replace(/\n/g, '<br>');
    // Highlight the material/finish diversification (e.g. GI 80GSM, MS Hot Dip).
    if (it.finish) { const f = esc(it.finish); desc = desc.replace(f, `<b class="fin-hl">${f}</b>`); }
    const z = qtyZero(it.qty);
    rows += `<tr>
      <td class="c">${it.sl != null ? it.sl : i + 1}</td>
      <td><div class="qdesc">${thumb(it.desc)}<span>${desc}</span></div></td>
      <td class="c">${z ? '' : esc(it.unit || '')}</td>
      <td class="c">${z ? '' : esc(it.qty)}</td>
      <td class="r">${fmtINR(it.rate)}</td>
      <td class="r b">${z ? '' : fmtINR(it.amount)}</td></tr>`;
  });
  const fillerCount = Math.max(0, 6 - M.items.length);
  for (let f = 0; f < fillerCount; f++) rows += '<tr><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>';

  const img = (k, glob) => (M.images && M.images[k]) || (typeof glob !== 'undefined' ? glob : '');
  const logo = img('logo', typeof LOGO_IMG !== 'undefined' ? LOGO_IMG : undefined);
  const cert = img('cert', typeof CERT_IMG !== 'undefined' ? CERT_IMG : undefined);
  const wm = img('watermark', typeof WATERMARK_IMG !== 'undefined' ? WATERMARK_IMG : undefined);
  const seal = img('seal', typeof SEAL_IMG !== 'undefined' ? SEAL_IMG : undefined);
  const hsn = TERMS_CONDITIONS[0];
  const yellowTerms = TERMS_CONDITIONS.slice(1);
  const qtnNo = M.qtnNo, client = M.client, date = M.date;
  const editAttr = editable ? ' contenteditable="true" spellcheck="false"' : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fixotech Quotation</title><style>
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
@page{size:${paperCss};margin:8mm}
body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:8mm;color:#000;font-size:10px}
.doc{border:1.5px solid #000;position:relative}
.layer{position:relative;z-index:1}
.draftbanner{text-align:center;font-weight:bold;font-size:11px;color:#c00000;background:#ffe9e9;border-bottom:1px solid #000;padding:3px 0;letter-spacing:.5px}
.draftstamp{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;z-index:2;pointer-events:none;overflow:hidden}
.draftstamp span{font-size:80px;font-weight:900;color:rgba(200,0,0,.13);transform:rotate(-32deg);white-space:nowrap;letter-spacing:4px}
.prodwrap{position:relative}
.wm{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;opacity:.18;pointer-events:none;z-index:0}
.wm img{width:34%;max-width:200px}
.prod{position:relative;z-index:1;background:transparent}
table{width:100%;border-collapse:collapse}
td,th{border:1px solid #000;padding:3px 4px;vertical-align:middle}
.c{text-align:center}.r{text-align:right}.b{font-weight:bold}
.head td{border:none}
.headwrap{display:flex;border-bottom:1px solid #000}
.logobox{flex:1;border-right:1px solid #000;padding:6px 8px;text-align:center}
.logobox img{max-height:46px;max-width:100%}
.iso{font-weight:bold;font-size:10px;margin-top:2px}
.certbox{width:150px;padding:5px;text-align:center;display:flex;align-items:center;justify-content:center}
.certbox img{max-height:52px;max-width:100%}
.line{text-align:center;font-size:8.5px;border-bottom:1px solid #000;padding:2px 4px}
.title{text-align:center;font-weight:bold;font-size:15px;letter-spacing:1px;border-bottom:1px solid #000;padding:4px 0}
.ref td{font-size:9.5px}
.ref .cl{color:#8a0000;font-weight:bold}
.prod th{font-weight:bold;text-align:center;font-size:10px;background:#fff}
.make td{background:#dbe5f1;font-weight:bold;font-size:11px}
.tot td{font-weight:bold}
.qdesc{display:flex;align-items:center;gap:6px}
.fin-hl{color:#1d4ed8;font-weight:bold;background:#eef2ff;padding:0 4px;border-radius:3px}
.qthumb{height:34px;width:auto;max-width:52px;object-fit:contain}
${(window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.SLOT_CSS) || ''}
.yrow td{font-weight:bold;font-size:9.5px}
.hsn td{background:#ade1ea}
.yellow td{background:#ffff00}
.tchdr td{font-weight:bold;font-size:11px}
.tc td{border:none;border-bottom:1px solid #000;font-size:9px;padding:3px 4px}
.tc .lbl{width:135px;font-weight:bold}
.tc.red .val{color:#c00000;font-weight:bold}
.tc.pay td{font-size:11px;font-weight:bold}
.note td{font-size:8px;border-top:none}
.sig{height:80px}
.sig .lft{width:60%;position:relative;font-weight:bold;font-size:10px;vertical-align:top}
.sig .seal{position:absolute;left:6px;bottom:20px;height:44px}
.sig .as{position:absolute;left:6px;bottom:2px}
.foot td{color:#c00000;text-align:center;font-weight:bold;font-size:9px;border-top:none}
.layer[contenteditable]{cursor:text}
.layer[contenteditable] td:hover{background:rgba(59,130,246,.07)}
.layer[contenteditable]:focus-within td:focus,[contenteditable] :focus{outline:2px solid #3b82f6;outline-offset:-2px}
@media print{body{padding:0}.doc{border:1.5px solid #000}.layer[contenteditable] td:hover{background:transparent}}
</style></head><body>
<div class="doc">
${isDraft ? `<div class="draftstamp"><span>FOR APPROVAL</span></div>` : ''}
<div class="layer"${editAttr}>
  <div class="headwrap">
    <div class="logobox">
      ${logo ? `<img id="pv-logo" src="${logo}">` : `<b style="font-size:20px">FIXOTECH</b><div class="iso">ISO 9001 : 2015 CERTIFIED COMPANY</div>`}
    </div>
    <div class="certbox">${cert ? `<img id="pv-cert" src="${cert}">` : ''}</div>
  </div>
  <div class="line">${esc(COMPANY_ADDRESS)}</div>
  <div class="line">${esc(COMPANY_CONTACT)}</div>
  <div class="title">QUOTATION</div>
  ${isDraft ? `<div class="draftbanner">FOR APPROVAL &mdash; DRAFT (NOT A FINAL QUOTE)</div>` : ''}

  <table class="ref">
    <tr><td style="width:50%"><b>QTN No.</b> ${esc(qtnNo)}</td><td style="width:27%"><b>QTN Date :-</b> ${esc(date)}</td><td class="c"><b>${esc(M.mktg || 'MKTG / R / 03')}</b></td></tr>
    <tr><td><b>To</b></td><td><b>ENQUIRY REF :-</b> ${esc(M.enquiryRef || '')}</td><td class="c"><b>Dt :-</b> ${esc(M.dt || '')}</td></tr>
    <tr><td><b>M/s</b> <span class="cl">${esc(client)}</span></td><td><b>SOURCE :-</b> ${esc(M.source || '')}</td><td class="c"><b>AMENDED</b></td></tr>
    <tr><td>&nbsp;</td><td>&nbsp;</td><td class="c"><b>DATED</b></td></tr>
  </table>

  <div class="prodwrap">
  ${wm ? `<div class="wm"><img id="pv-wm" src="${wm}"></div>` : ''}
  <table class="prod">
    <tr><th style="width:9%">SL.NO</th><th style="width:43%">DESCRIPTION</th><th style="width:9%">UNIT</th><th style="width:9%">QTY</th><th style="width:14%">RATES</th><th style="width:16%">AMOUNT</th></tr>
    <tr class="make"><td></td><td>MAKE :- FIXOTECH</td><td></td><td></td><td></td><td></td></tr>
    ${rows}
    <tr class="tot"><td rowspan="3" colspan="4"></td><td class="r">TOTAL</td><td class="r">${fmtINR(M.total)}</td></tr>
    ${M.freight > 0
      ? `<tr class="tot"><td class="r">FREIGHT</td><td class="r">${fmtINR(M.freight)}</td></tr>
    <tr class="tot"><td class="r">GST</td><td class="c">EXTRA</td></tr>`
      : `<tr class="tot"><td class="r">FREIGHT</td><td class="c" rowspan="2">EXTRA</td></tr>
    <tr class="tot"><td class="r">GST</td></tr>`}
  </table>
  </div>

  <table>
    <tr class="hsn yrow"><td colspan="6">${esc(hsn)}</td></tr>
    ${yellowTerms.map(t => `<tr class="yellow yrow"><td colspan="6">${esc(t)}</td></tr>`).join('')}
  </table>

  <table>
    <tr class="tchdr"><td colspan="2">Terms  &amp; Conditions</td></tr>
  </table>
  <table>
    <tr class="tc"><td class="lbl">Taxes</td><td class="val">:  Duties &amp; Taxes Extra As applicable - (18% GST)</td></tr>
    <tr class="tc"><td class="lbl">Delivery Charges</td><td class="val">:  Packing &amp; Delivery charges extra at actuals.</td></tr>
    <tr class="tc red"><td class="lbl">Unloading</td><td class="val">:  In your scope</td></tr>
    <tr class="tc pay"><td class="lbl">Payments</td><td class="val">:  50% Advance and balance 50% before despatch</td></tr>
    <tr class="note"><td colspan="2"><b>Note:</b> Prices are subject to change depends upon the changes in the sheet rates prevailing</td></tr>
  </table>

  <table>
    <tr class="sig">
      <td class="lft">Yours Truly,<br>For ${esc(COMPANY_NAME)}
        ${seal ? `<img id="pv-seal" class="seal" src="${seal}">` : ''}
        <span class="as">Authorised Signatory</span>
      </td>
      <td></td>
    </tr>
    <tr class="foot"><td colspan="2">${esc(FOOTER_NOTE)}</td></tr>
  </table>
</div>
</div>
</body></html>`;
  return html;
}

// Print path used when jsPDF isn't available (edge case) — prints the HTML.
function downloadPDFFallback(client, date, mode, paper) {
  const model = Object.assign(buildQuoteModel(), { client, date });
  const html = buildQuoteHtml(model, { isDraft: mode === 'approval', paper });
  let iframe = document.getElementById('pdf-iframe');
  if (!iframe) { iframe = document.createElement('iframe'); iframe.id = 'pdf-iframe'; iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:900px;height:700px'; document.body.appendChild(iframe); }
  const d = iframe.contentDocument || iframe.contentWindow.document;
  d.open(); d.write(html); d.close();
  setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 400);
  toast('Print dialog opened');
}

// ----------------------------------------------------------------
// WHATSAPP
// ----------------------------------------------------------------
function openWhatsAppModal() {
  if (quoteItems.length === 0) { toast('Add items to quote first'); return; }
  const client = document.getElementById('client-name').value.trim() || 'N/A';
  let msg = '*FIXOTECH - Cable Tray Quote*\nClient: ' + client + '\nDate: ' + new Date().toLocaleDateString() + '\n' + '─'.repeat(25) + '\n';
  let tc = 0, tw = 0;
  quoteItems.forEach((item, i) => {
    tc += item.totalCost; tw += item.totalWeight;
    msg += '\n*' + (i+1) + '. ' + item.name + '* (' + item.sheet.toUpperCase() + ')\nQty: ' + item.qty + ' ' + (item.type === 'linear' ? 'meters' : 'pcs') + '\nCost: Rs.' + item.totalCost.toLocaleString() + '\n';
  });
  msg += '\n' + '─'.repeat(25) + '\n*TOTAL: Rs.' + tc.toLocaleString() + '/-*\nWeight: ' + tw.toFixed(2) + ' kg\n';
  document.getElementById('wa-preview').value = msg;
  document.getElementById('wa-phone').value = '';
  document.getElementById('whatsapp-modal').classList.add('show');
}

function closeWAModal() { document.getElementById('whatsapp-modal').classList.remove('show'); }

// ----------------------------------------------------------------
// SHARE HELPERS — attach the actual quotation file(s) to WhatsApp / Email
// ----------------------------------------------------------------
// Build File objects for the current quote (PDF and/or CSV).
function currentQuoteFiles(kinds) {
  const files = [];
  (kinds || ['pdf']).forEach(k => {
    if (k === 'pdf') { const r = downloadPDF('final', { returnBlob: true }); if (r && r.blob) files.push(new File([r.blob], r.filename, { type: 'application/pdf' })); }
    if (k === 'csv') { const r = exportCSV({ returnBlob: true }); if (r && r.blob) files.push(new File([r.blob], r.filename, { type: 'text/csv' })); }
  });
  return files;
}
function downloadFileObj(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
// Try the native share sheet with real file attachments (works on mobile/web
// and any platform that supports the Web Share Files API).
async function shareQuoteFiles(files, title, text) {
  try {
    if (files.length && navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files, title, text });
      return 'shared';
    }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  return 'unsupported';
}

async function sendWhatsApp() {
  const phone = document.getElementById('wa-phone').value.trim().replace(/[^0-9]/g, '');
  const text = document.getElementById('wa-preview').value;
  if (!phone || phone.length < 10) { toast('Enter a valid phone number'); return; }
  const kinds = getSendKinds('wa');
  const files = currentQuoteFiles(kinds);
  const res = await shareQuoteFiles(files, 'Fixotech Quotation', text);
  if (res === 'shared') { closeWAModal(); toast('Quotation shared via WhatsApp'); return; }
  if (res === 'cancelled') return;
  // Fallback (desktop): download the file(s), open the chat with the message
  files.forEach(downloadFileObj);
  const note = files.length ? '\n\n[' + files.map(f => f.name).join(', ') + ' downloaded — attach in this chat]' : '';
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(text + note), '_blank');
  closeWAModal();
  toast(files.length ? 'File downloaded — attach it in WhatsApp' : 'WhatsApp opened');
}

// Which file types to send, based on the modal's checkboxes.
function getSendKinds(prefix) {
  const kinds = [];
  const pdf = document.getElementById(prefix + '-attach-pdf');
  const csv = document.getElementById(prefix + '-attach-csv');
  if (!pdf && !csv) return ['pdf'];
  if (pdf && pdf.checked) kinds.push('pdf');
  if (csv && csv.checked) kinds.push('csv');
  return kinds.length ? kinds : ['pdf'];
}

// ----------------------------------------------------------------
// EMAIL
// ----------------------------------------------------------------
function openEmailModal() {
  if (quoteItems.length === 0) { toast('Add items to quote first'); return; }
  const client = document.getElementById('client-name').value.trim() || 'N/A';

  let body = 'FIXOTECH - Cable Tray Estimation Quotation\n';
  body += 'Client/Project: ' + client + '\n';
  body += 'Date: ' + new Date().toLocaleDateString() + '\n';
  body += '='.repeat(50) + '\n\n';

  let tc = 0, tw = 0;
  quoteItems.forEach((item, i) => {
    tc += item.totalCost; tw += item.totalWeight;
    body += (i+1) + '. ' + item.name + ' (' + item.sheet.toUpperCase() + ')\n';
    body += '   Qty: ' + item.qty + ' ' + (item.type === 'linear' ? 'Meters' : 'Pieces') + '\n';
    Object.keys(item.breakdown).forEach(k => {
      if (k !== 'quote' && k !== 'weight') body += '   ' + k + ': ' + item.breakdown[k] + '\n';
    });
    body += '   Cost: Rs.' + item.totalCost.toLocaleString() + '\n\n';
  });
  body += '='.repeat(50) + '\n';
  body += 'TOTAL COST: Rs.' + tc.toLocaleString() + '/-\n';
  body += 'TOTAL WEIGHT: ' + tw.toFixed(2) + ' kg\n';

  document.getElementById('email-to').value = '';
  document.getElementById('email-subject').value = 'Fixotech - Cable Tray Quotation - ' + client;
  document.getElementById('email-preview').value = body;
  document.getElementById('email-modal').classList.add('show');
}

function closeEmailModal() { document.getElementById('email-modal').classList.remove('show'); }

async function sendEmail() {
  const to = document.getElementById('email-to').value.trim();
  const subject = document.getElementById('email-subject').value.trim();
  const body = document.getElementById('email-preview').value;
  if (!to || !to.includes('@')) { toast('Enter a valid email address'); return; }
  const kinds = getSendKinds('email');
  const files = currentQuoteFiles(kinds);

  // 1) If a mail backend (SMTP) is configured, send with the file attached.
  if (window.FixoDB && FixoDB.getCfg && FixoDB.getCfg().apiUrl && FixoDB.getCfg().smtpReady) {
    try {
      const attachments = await Promise.all(files.map(async f => ({ filename: f.name, contentBase64: await blobToBase64(f), mimeType: f.type })));
      const res = await fetch(FixoDB.getCfg().apiUrl.replace(/\/$/, '') + '/api/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text: body, attachments })
      });
      if (res.ok) { closeEmailModal(); toast('Email sent with attachment'); return; }
      throw new Error(await res.text());
    } catch (e) { toast('Backend send failed — using mail app'); }
  }

  // 2) Native share sheet with real attachment (mobile/web).
  const res = await shareQuoteFiles(files, subject, body);
  if (res === 'shared') { closeEmailModal(); toast('Shared via mail app'); return; }
  if (res === 'cancelled') return;

  // 3) Fallback: download the file(s) + open the mail client (attach manually).
  files.forEach(downloadFileObj);
  const note = files.length ? '\n\n[' + files.map(f => f.name).join(', ') + ' downloaded — please attach]' : '';
  const mailUrl = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body + note);
  try {
    const w = window.open(mailUrl, '_blank');
    if (!w) { const a = document.createElement('a'); a.href = mailUrl; a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
  } catch (e) { window.location.href = mailUrl; }
  closeEmailModal();
  toast(files.length ? 'File downloaded — attach it to the email' : 'Email client opened');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// ----------------------------------------------------------------
// TOAST
// ----------------------------------------------------------------
function toast(msg) {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '✓ ' + msg;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 300); }, 2500);
}

// ----------------------------------------------------------------
// BRIDGE: exposes calculator internals to the client-database module
// ----------------------------------------------------------------
window.FIXO = {
  toast,
  getClientName() { const el = document.getElementById('client-name'); return el ? el.value.trim() : ''; },
  setClientName(name) { const el = document.getElementById('client-name'); if (el) el.value = name || ''; },
  // Snapshot of the current quote for saving as an order
  getQuoteSnapshot() {
    let totalCost = 0, totalWeight = 0;
    const items = quoteItems.map(i => {
      totalCost += i.totalCost; totalWeight += i.totalWeight;
      return {
        productKey: i.productKey, name: i.name, sheet: i.sheet, type: i.type,
        inputs: JSON.parse(JSON.stringify(i.inputs)), qty: i.qty,
        overrides: JSON.parse(JSON.stringify(i.overrides || {})),
        quoteRate: i.quoteRate, totalCost: i.totalCost, totalWeight: i.totalWeight
      };
    });
    return { items, totalCost, totalWeight, count: items.length };
  },
  hasQuoteItems() { return quoteItems.length > 0; },
  // --- Edit propagation: the last verified/edited quotation (from the PDF or
  // Excel Verify window) becomes the source of truth that flows to the PI. ---
  setEditedQuote(model) {
    if (model == null) { editedQuote = null; try { localStorage.removeItem('fixo_edited_quote'); } catch (e) {} return; }
    try {
      editedQuote = {
        client: model.client, qtnNo: model.qtnNo, date: model.date,
        freight: model.freight || 0, deliverAddr: model.deliverAddr || '',
        items: (model.items || []).map(it => ({ desc: it.desc, unit: it.unit, qty: it.qty, rate: it.rate, amount: it.amount })),
        total: model.total, sig: currentQuoteSig(), ts: Date.now()
      };
      localStorage.setItem('fixo_edited_quote', JSON.stringify(editedQuote));
    } catch (e) {}
  },
  // Only return edits that belong to the CURRENT quote (same set of line items),
  // so edits from a previous customer/order never leak into a new one.
  getEditedQuote() {
    if (editedQuote && editedQuote.sig && editedQuote.sig !== currentQuoteSig()) return null;
    return editedQuote;
  },
  // Bundle everything the Proforma needs — prefers the edited quotation so any
  // negotiation/approval edits are carried across.
  getForwardData() {
    const frEl = document.getElementById('quote-freight');
    const daEl = document.getElementById('quote-deliver-addr');
    const liveFreight = frEl ? (parseFloat(String(frEl.value).replace(/[^0-9.\-]/g, '')) || 0) : 0;
    const liveAddr = daEl ? daEl.value.trim() : '';
    const eq = this.getEditedQuote();
    if (eq && Array.isArray(eq.items) && eq.items.length) {
      return {
        client: eq.client && eq.client !== 'N/A' ? eq.client : this.getClientName(),
        items: eq.items.map(it => ({ desc: it.desc, unit: it.unit, qty: it.qty, rate: it.rate, amount: it.amount })),
        freight: eq.freight || liveFreight, deliverAddr: eq.deliverAddr || liveAddr, edited: true
      };
    }
    const snap = this.getQuoteSnapshot();
    return {
      client: this.getClientName(),
      items: snap.items.map(it => ({ desc: it.name || '', unit: it.type === 'linear' ? 'Mtr' : 'Nos', qty: it.qty, rate: it.quoteRate, amount: it.totalCost })),
      freight: liveFreight, deliverAddr: liveAddr, edited: false
    };
  },
  // Load a stored order's line items back into the workspace for re-quoting
  loadOrderItems(items) {
    if (!Array.isArray(items)) return 0;
    let loaded = 0;
    items.forEach(it => {
      if (!it || !PRODUCTS_DB[it.productKey]) return;
      workspaceItems.push({
        id: nextId++, productKey: it.productKey,
        inputs: JSON.parse(JSON.stringify(it.inputs || {})),
        qty: it.qty || 1,
        overrides: JSON.parse(JSON.stringify(it.overrides || {}))
      });
      loaded++;
    });
    renderWorkspace();
    const ws = document.getElementById('workspace');
    if (ws) setTimeout(() => ws.scrollTo({ top: ws.scrollHeight, behavior: 'smooth' }), 50);
    return loaded;
  }
};
