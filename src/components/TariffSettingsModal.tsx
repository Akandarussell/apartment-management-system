import React, { useState } from 'react';
import { X, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import { NescoTariffConfig } from '../types';

interface Props {
  tariffConfig: NescoTariffConfig;
  onSave: (config: NescoTariffConfig) => void;
  onClose: () => void;
}

export const TariffSettingsModal: React.FC<Props> = ({ tariffConfig, onSave, onClose }) => {
  const [title, setTitle] = useState(tariffConfig.title);
  const [demandCharge, setDemandCharge] = useState(tariffConfig.demandChargePerKW);
  const [vat, setVat] = useState(tariffConfig.vatPercentage);
  const [meterRent, setMeterRent] = useState(tariffConfig.meterRent);
  const [slabs, setSlabs] = useState(tariffConfig.slabs);

  const handleSlabRateChange = (index: number, newRate: number) => {
    const updated = [...slabs];
    updated[index] = { ...updated[index], ratePerUnit: newRate };
    setSlabs(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...tariffConfig,
      title,
      demandChargePerKW: demandCharge,
      vatPercentage: vat,
      meterRent,
      slabs,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Settings className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base">NESCO Tariff Configuration Engine</h3>
              <p className="text-xs text-slate-500">Configure progressive slabs, demand charges, and VAT</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Tariff Title / Notice Reference</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Demand Charge (৳/KW)</label>
              <input
                type="number"
                step="0.01"
                value={demandCharge}
                onChange={(e) => setDemandCharge(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Government VAT (%)</label>
              <input
                type="number"
                step="0.1"
                value={vat}
                onChange={(e) => setVat(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Sub-Meter Rent (৳)</label>
              <input
                type="number"
                step="0.01"
                value={meterRent}
                onChange={(e) => setMeterRent(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
              />
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">
              Progressive Consumption Slabs
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {slabs.map((slab, i) => (
                <div key={i} className="p-2.5 flex items-center justify-between bg-slate-50/50">
                  <span className="font-semibold text-slate-800">{slab.slabName}</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-slate-500">৳</span>
                    <input
                      type="number"
                      step="0.01"
                      value={slab.ratePerUnit}
                      onChange={(e) => handleSlabRateChange(i, Number(e.target.value))}
                      className="w-20 px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold text-slate-900"
                    />
                    <span className="text-slate-500">/ unit</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
            >
              Save Tariff Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
