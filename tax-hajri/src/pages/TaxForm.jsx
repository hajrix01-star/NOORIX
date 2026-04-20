import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taxAppClient } from '@/api/taxAppClient';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowRight, Save, Printer, Calculator, 
  TrendingUp, Receipt, Package,
  AlertCircle, CheckCircle, RefreshCw, Check
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const QUARTERS = {
  Q1: 'الربع الأول',
  Q2: 'الربع الثاني',
  Q3: 'الربع الثالث',
  Q4: 'الربع الرابع'
};

// تحويل الأرباع القديمة إلى الصيغة الجديدة
const normalizeQuarter = (quarter) => {
  if (!quarter) return 'Q1';
  if (quarter.startsWith('Q')) return quarter;
  
  const oldToNew = {
    'الربع الأول': 'Q1',
    'الربع الثاني': 'Q2',
    'الربع الثالث': 'Q3',
    'الربع الرابع': 'Q4',
    'First Quarter': 'Q1',
    'Second Quarter': 'Q2',
    'Third Quarter': 'Q3',
    'Fourth Quarter': 'Q4'
  };
  
  return oldToNew[quarter] || quarter;
};

const getPreviousQuarter = () => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  
  if (month >= 0 && month <= 2) return { quarter: 'Q4', year: year - 1 };
  if (month >= 3 && month <= 5) return { quarter: 'Q1', year };
  if (month >= 6 && month <= 8) return { quarter: 'Q2', year };
  return { quarter: 'Q3', year };
};

export default function TaxForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('id');
  const companyIdFromUrl = urlParams.get('company');
  
  const defaultPeriod = getPreviousQuarter();
  const yearFromUrl = urlParams.get('year') || defaultPeriod.year.toString();
  const quarterFromUrl = urlParams.get('quarter') || defaultPeriod.quarter;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const printRef = useRef();

  const [autoCalculate, setAutoCalculate] = useState(true);
  const [targetPayment, setTargetPayment] = useState(0);
  
  const [formData, setFormData] = useState({
    company_id: companyIdFromUrl || '',
    year: parseInt(yearFromUrl),
    quarter: quarterFromUrl,
    status: 'submitted',
    local_sales_standard: 0,
    gcc_sales: 0,
    local_sales_zero: 0,
    exempt_sales: 0,
    exports: 0,
    local_purchases_standard: 0,
    imports_vat_paid: 0,
    imports_reverse_charge: 0,
    purchases_zero: 0,
    exempt_purchases: 0,
    target_tax_payment: 0,
    notes: ''
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => taxAppClient.entities.Company.list()
  });

  const { data: existingReport, isLoading } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => taxAppClient.entities.TaxReport.filter({ id: reportId }),
    enabled: !!reportId,
    select: (data) => data[0]
  });

  const { data: previousQuarterReport } = useQuery({
    queryKey: ['previousReport', formData.company_id, formData.quarter, formData.year],
    queryFn: async () => {
      if (!formData.company_id) return null;
      
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
      const currentIndex = quarters.indexOf(formData.quarter);
      
      let year = formData.year;
      let quarter = formData.quarter;
      
      if (currentIndex === 0) {
        year -= 1;
        quarter = 'Q4';
      } else {
        quarter = quarters[currentIndex - 1];
      }
      
      const allReports = await taxAppClient.entities.TaxReport.filter({ company_id: formData.company_id });
      const report = allReports.find(r => r.year === year && r.quarter === quarter);
      
      return report || null;
    },
    enabled: !!formData.company_id
  });

  useEffect(() => {
    if (existingReport) {
      setFormData({
        ...existingReport,
        quarter: normalizeQuarter(existingReport.quarter)
      });
      setTargetPayment(existingReport.target_tax_payment || 0);
    }
  }, [existingReport]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (reportId) {
        return taxAppClient.entities.TaxReport.update(reportId, data);
      } else {
        return taxAppClient.entities.TaxReport.create(data);
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries(['reports']);
      toast.success('تم حفظ الإقرار بنجاح', {
        description: reportId ? 'تم تحديث البيانات' : 'تم إنشاء إقرار جديد'
      });
      
      if (!reportId) {
        // Reset form when creating new report
        setFormData({
          company_id: '',
          year: parseInt(new Date().getFullYear().toString()),
          quarter: 'Q1',
          status: 'submitted',
          local_sales_standard: 0,
          gcc_sales: 0,
          local_sales_zero: 0,
          exempt_sales: 0,
          exports: 0,
          local_purchases_standard: 0,
          imports_vat_paid: 0,
          imports_reverse_charge: 0,
          purchases_zero: 0,
          exempt_purchases: 0,
          target_tax_payment: 0,
          notes: ''
        });
        setTargetPayment(0);
        setAutoCalculate(true);
        
        if (result?.id) {
          navigate(createPageUrl('TaxForm') + `?id=${result.id}`);
        }
      }
    }
  });

  // Tax Calculations
  const outputTaxStandard = (formData.local_sales_standard || 0) * 0.15;
  const outputTaxGCC = (formData.gcc_sales || 0) * 0.15;
  const totalOutputTax = outputTaxStandard + outputTaxGCC;

  const inputTaxLocal = (formData.local_purchases_standard || 0) * 0.15;
  const inputTaxImports = (formData.imports_vat_paid || 0) * 0.15;
  const inputTaxReverse = (formData.imports_reverse_charge || 0) * 0.15;
  const totalInputTax = inputTaxLocal + inputTaxImports + inputTaxReverse;

  const netTax = totalOutputTax - totalInputTax;

  // Calculate required purchases to achieve target payment
  const calculateRequiredPurchases = () => {
    if (!autoCalculate || targetPayment <= 0) return 0;
    const requiredInputTax = totalOutputTax - targetPayment;
    const currentInputTaxWithoutLocal = inputTaxImports + inputTaxReverse;
    const requiredLocalInputTax = requiredInputTax - currentInputTaxWithoutLocal;
    return Math.max(0, requiredLocalInputTax / 0.15);
  };

  const requiredPurchases = calculateRequiredPurchases();

  const handleAutoFillPurchases = () => {
    const calculatedPurchases = calculateRequiredPurchases();
    if (calculatedPurchases >= 0) {
      setFormData(prev => ({
        ...prev,
        local_purchases_standard: calculatedPurchases,
        target_tax_payment: targetPayment
      }));
    }
  };

  const handleInputChange = (field, value) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const handleSave = () => {
    saveMutation.mutate({
      ...formData,
      target_tax_payment: targetPayment
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedCompany = companies.find(c => c.id === formData.company_id);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Helper function to get previous quarter label


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            direction: rtl;
            background: white;
          }
          .no-print { display: none !important; }
          .print-row {
            page-break-inside: avoid;
          }
          .print-section {
            margin-bottom: 15px;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          .print-table th {
            background: #f1f5f9;
            padding: 8px;
            text-align: right;
            border: 1px solid #cbd5e1;
            font-weight: 600;
          }
          .print-table td {
            padding: 8px;
            border: 1px solid #e2e8f0;
          }
          .print-header {
            text-align: center;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 2px solid #059669;
          }
          .print-summary {
            background: #f8fafc;
            padding: 12px;
            border: 2px solid #059669;
            border-radius: 8px;
            margin-top: 20px;
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 no-print">
          <Link to={createPageUrl('Companies')} className="hover:text-emerald-600">الشركات</Link>
          <ArrowRight className="w-4 h-4 rotate-180" />
          <Link to={createPageUrl('TaxReports') + `?company=${formData.company_id}`} className="hover:text-emerald-600">التقارير</Link>
          <ArrowRight className="w-4 h-4 rotate-180" />
          <span className="text-slate-800">الإقرار الضريبي</span>
        </div>

        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 no-print">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              {reportId ? 'تعديل الإقرار الضريبي' : 'إقرار ضريبي جديد'}
            </h1>
            <p className="text-slate-500 mt-1">نموذج إقرار ضريبة القيمة المضافة</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" />
              طباعة
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </div>
        </div>

        {/* Print Area - Separate */}
        <div id="print-area" className="hidden print:block">
          <div className="print-header" style={{marginBottom: '20px', paddingBottom: '10px'}}>
            <h2 className="text-lg font-bold mb-1">هيئة الزكاة والضريبة والجمارك</h2>
            <h3 className="text-base font-bold">إقرار ضريبة القيمة المضافة</h3>
            <div className="mt-3 text-sm">
              <p className="font-semibold">{selectedCompany?.name}</p>
              {selectedCompany?.tax_number && (
                <p>الرقم الضريبي: {selectedCompany.tax_number}</p>
              )}
              <p>{QUARTERS[formData.quarter]} - {formData.year}</p>
            </div>
          </div>

          <table className="print-table" style={{fontSize: '13px'}}>
            <thead>
              <tr>
                <th style={{width: '50%', textAlign: 'right', fontSize: '14px'}}>البيان</th>
                <th style={{width: '25%', textAlign: 'center', fontSize: '14px'}}>المبلغ (ريال)</th>
                <th style={{width: '25%', textAlign: 'center', fontSize: '14px'}}>الضريبة (ريال)</th>
              </tr>
            </thead>
            <tbody>
              {/* Sales Section */}
              <tr style={{background: '#e0f2fe'}}>
                <td colSpan="3" className="font-bold" style={{padding: '6px 8px'}}>المبيعات (ضريبة المخرجات)</td>
              </tr>
              {(formData.local_sales_standard || 0) > 0 && (
                <tr>
                  <td>المبيعات المحلية (15%)</td>
                  <td className="text-center">{(formData.local_sales_standard || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="text-center font-semibold">{((formData.local_sales_standard || 0) * 0.15).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              )}
              {(formData.gcc_sales || 0) > 0 && (
                <tr>
                  <td>مبيعات دول مجلس التعاون</td>
                  <td className="text-center">{(formData.gcc_sales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="text-center font-semibold">{((formData.gcc_sales || 0) * 0.15).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              )}
              {(formData.local_sales_zero || 0) > 0 && (
                <tr>
                  <td>المبيعات بنسبة صفرية</td>
                  <td className="text-center">{(formData.local_sales_zero || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="text-center">0.00</td>
                </tr>
              )}
              {(formData.exempt_sales || 0) > 0 && (
                <tr>
                  <td>المبيعات المعفاة</td>
                  <td className="text-center">{(formData.exempt_sales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="text-center">0.00</td>
                </tr>
              )}
              <tr style={{background: '#dbeafe', fontWeight: 'bold'}}>
                <td colSpan="2" style={{textAlign: 'left', paddingRight: '8px'}}>إجمالي ضريبة المخرجات</td>
                <td className="text-center">{totalOutputTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>

              {/* Purchases Section */}
              <tr style={{background: '#d1fae5'}}>
                <td colSpan="3" className="font-bold" style={{padding: '6px 8px'}}>المشتريات (ضريبة المدخلات)</td>
              </tr>
              {(formData.local_purchases_standard || 0) > 0 && (
                <tr>
                  <td>المشتريات المحلية (15%)</td>
                  <td className="text-center">{(formData.local_purchases_standard || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="text-center font-semibold">{((formData.local_purchases_standard || 0) * 0.15).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              )}
              {(formData.imports_vat_paid || 0) > 0 && (
                <tr>
                  <td>الاستيرادات المدفوعة عند الجمارك</td>
                  <td className="text-center">{(formData.imports_vat_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="text-center font-semibold">{((formData.imports_vat_paid || 0) * 0.15).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              )}
              {(formData.imports_reverse_charge || 0) > 0 && (
                <tr>
                  <td>الاستيرادات بالاحتساب العكسي</td>
                  <td className="text-center">{(formData.imports_reverse_charge || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="text-center font-semibold">{((formData.imports_reverse_charge || 0) * 0.15).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              )}
              {(formData.purchases_zero || 0) > 0 && (
                <tr>
                  <td>المشتريات بنسبة صفرية</td>
                  <td className="text-center">{(formData.purchases_zero || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="text-center">0.00</td>
                </tr>
              )}
              {(formData.exempt_purchases || 0) > 0 && (
                <tr>
                  <td>المشتريات المعفاة</td>
                  <td className="text-center">{(formData.exempt_purchases || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="text-center">0.00</td>
                </tr>
              )}
              <tr style={{background: '#d1fae5', fontWeight: 'bold'}}>
                <td colSpan="2" style={{textAlign: 'left', paddingRight: '8px'}}>إجمالي ضريبة المدخلات</td>
                <td className="text-center">{totalInputTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>

              {/* Net Tax */}
              <tr style={{background: netTax > 0 ? '#fee2e2' : '#d1fae5', fontWeight: 'bold', fontSize: '15px'}}>
                <td colSpan="2" style={{textAlign: 'left', paddingRight: '8px'}}>
                  صافي ضريبة القيمة المضافة {netTax > 0 ? '(واجب السداد)' : '(قابل للاسترداد)'}
                </td>
                <td className="text-center" style={{fontSize: '16px'}}>{netTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Main Form Area */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Form - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Company & Period Selection */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-6 space-y-6">
                {/* Company Selection */}
                <div className="space-y-3">
                  <Label>الشركة</Label>
                  <div className="flex flex-wrap gap-2">
                    {companies.map(company => (
                      <Button
                        key={company.id}
                        onClick={() => setFormData(prev => ({...prev, company_id: company.id}))}
                        disabled={!!reportId}
                        variant={formData.company_id === company.id ? 'default' : 'outline'}
                        className={formData.company_id === company.id 
                          ? 'bg-emerald-600 hover:bg-emerald-700' 
                          : 'hover:border-emerald-300'}
                      >
                        {formData.company_id === company.id && <Check className="w-4 h-4 ml-2" />}
                        {company.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Year Selection */}
                <div className="space-y-3">
                  <Label>السنة</Label>
                  <div className="flex flex-wrap gap-2">
                    {years.map(year => (
                      <Button
                        key={year}
                        onClick={() => setFormData(prev => ({...prev, year: year}))}
                        disabled={!!reportId}
                        variant={formData.year === year ? 'default' : 'outline'}
                        className={formData.year === year 
                          ? 'bg-emerald-600 hover:bg-emerald-700' 
                          : 'hover:border-emerald-300'}
                      >
                        {formData.year === year && <Check className="w-4 h-4 ml-2" />}
                        {year}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Quarter Selection */}
                <div className="space-y-3">
                  <Label>الربع</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(QUARTERS).map(([key, label]) => (
                      <Button
                        key={key}
                        onClick={() => setFormData(prev => ({...prev, quarter: key}))}
                        disabled={!!reportId}
                        variant={formData.quarter === key ? 'default' : 'outline'}
                        className={formData.quarter === key 
                          ? 'bg-emerald-600 hover:bg-emerald-700' 
                          : 'hover:border-emerald-300'}
                      >
                        {formData.quarter === key && <Check className="w-4 h-4 ml-2" />}
                        {key}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Output Tax (Sales) */}
            <Card className="border-0 shadow-md overflow-hidden no-print">
              <div className="h-1 bg-gradient-to-l from-blue-500 to-blue-600"></div>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                  ضريبة المخرجات (المبيعات)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Local Sales Standard Rate */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">المبيعات المحلية الخاضعة للنسبة الأساسية</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.local_sales_standard || ''}
                        onChange={(e) => handleInputChange('local_sales_standard', e.target.value)}
                        className="pl-12 text-left"
                        dir="ltr"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ريال</span>
                    </div>
                    {previousQuarterReport && (
                      <p className="text-xs text-slate-500 mt-1">الربع السابق: {(previousQuarterReport.local_sales_standard || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-500">مبلغ الضريبة (15%)</Label>
                    <div className="p-3 bg-white rounded-lg border text-left font-semibold text-blue-600" dir="ltr">
                      {outputTaxStandard.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                    </div>
                  </div>
                </div>

                {/* GCC Sales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">المبيعات لعملاء مسجلين في دول مجلس التعاون</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.gcc_sales || ''}
                        onChange={(e) => handleInputChange('gcc_sales', e.target.value)}
                        className="pl-12 text-left"
                        dir="ltr"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ريال</span>
                    </div>
                    {previousQuarterReport && (
                      <p className="text-xs text-slate-500 mt-1">الربع السابق: {(previousQuarterReport.gcc_sales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-500">مبلغ الضريبة (15%)</Label>
                    <div className="p-3 bg-white rounded-lg border text-left font-semibold text-blue-600" dir="ltr">
                      {outputTaxGCC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                    </div>
                  </div>
                </div>

                {/* Zero Rate Sales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">المبيعات المحلية الخاضعة للنسبة الصفرية</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.local_sales_zero || ''}
                        onChange={(e) => handleInputChange('local_sales_zero', e.target.value)}
                        className="pl-12 text-left"
                        dir="ltr"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ريال</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-500">مبلغ الضريبة (0%)</Label>
                    <div className="p-3 bg-white rounded-lg border text-left text-slate-400" dir="ltr">
                      0.00 ريال
                    </div>
                  </div>
                </div>

                {/* Exempt Sales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">المبيعات المعفاة</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.exempt_sales || ''}
                        onChange={(e) => handleInputChange('exempt_sales', e.target.value)}
                        className="pl-12 text-left"
                        dir="ltr"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ريال</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-500">مبلغ الضريبة</Label>
                    <div className="p-3 bg-white rounded-lg border text-left text-slate-400" dir="ltr">
                      0.00 ريال
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Input Tax (Purchases) */}
            <Card className="border-0 shadow-md overflow-hidden no-print">
              <div className="h-1 bg-gradient-to-l from-emerald-500 to-emerald-600"></div>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-emerald-600" />
                  </div>
                  ضريبة المدخلات (المشتريات)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Local Purchases Standard Rate */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">المشتريات المحلية الخاضعة للنسبة الأساسية</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.local_purchases_standard || ''}
                        onChange={(e) => handleInputChange('local_purchases_standard', e.target.value)}
                        className="pl-12 text-left"
                        dir="ltr"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ريال</span>
                    </div>
                    {previousQuarterReport && (
                      <p className="text-xs text-slate-500 mt-1">الربع السابق: {(previousQuarterReport.local_purchases_standard || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-500">الضريبة القابلة للاسترداد</Label>
                    <div className="p-3 bg-white rounded-lg border text-left font-semibold text-emerald-600" dir="ltr">
                      {inputTaxLocal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                    </div>
                  </div>
                </div>

                {/* Imports VAT Paid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">الاستيرادات الخاضعة للضريبة المدفوعة عند الجمارك</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.imports_vat_paid || ''}
                        onChange={(e) => handleInputChange('imports_vat_paid', e.target.value)}
                        className="pl-12 text-left"
                        dir="ltr"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ريال</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-500">الضريبة القابلة للاسترداد</Label>
                    <div className="p-3 bg-white rounded-lg border text-left font-semibold text-emerald-600" dir="ltr">
                      {inputTaxImports.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                    </div>
                  </div>
                </div>

                {/* Imports Reverse Charge */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">الاستيرادات الخاضعة لآلية الاحتساب العكسي</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.imports_reverse_charge || ''}
                        onChange={(e) => handleInputChange('imports_reverse_charge', e.target.value)}
                        className="pl-12 text-left"
                        dir="ltr"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ريال</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-500">الضريبة القابلة للاسترداد</Label>
                    <div className="p-3 bg-white rounded-lg border text-left font-semibold text-emerald-600" dir="ltr">
                      {inputTaxReverse.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                    </div>
                  </div>
                </div>

                {/* Zero Rate Purchases */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">المشتريات الخاضعة للنسبة الصفرية</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.purchases_zero || ''}
                        onChange={(e) => handleInputChange('purchases_zero', e.target.value)}
                        className="pl-12 text-left"
                        dir="ltr"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ريال</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-500">الضريبة القابلة للاسترداد</Label>
                    <div className="p-3 bg-white rounded-lg border text-left text-slate-400" dir="ltr">
                      0.00 ريال
                    </div>
                  </div>
                </div>

                {/* Exempt Purchases */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">المشتريات المعفاة</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.exempt_purchases || ''}
                        onChange={(e) => handleInputChange('exempt_purchases', e.target.value)}
                        className="pl-12 text-left"
                        dir="ltr"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ريال</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-500">الضريبة القابلة للاسترداد</Label>
                    <div className="p-3 bg-white rounded-lg border text-left text-slate-400" dir="ltr">
                      0.00 ريال
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Tax Summary */}
            <Card className="border-0 shadow-md overflow-hidden sticky top-6">
              <div className="h-1 bg-gradient-to-l from-slate-600 to-slate-700"></div>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-slate-600" />
                  </div>
                  ملخص الضريبة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">إجمالي ضريبة المخرجات</span>
                    <span className="font-bold text-blue-700">
                      {totalOutputTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">ريال سعودي</p>
                </div>

                <div className="p-4 bg-emerald-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">إجمالي ضريبة المدخلات</span>
                    <span className="font-bold text-emerald-700">
                      {totalInputTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">ريال سعودي</p>
                </div>

                <Separator />

                <div className={`p-4 rounded-lg ${
                  netTax > 0 
                    ? 'bg-gradient-to-br from-red-500 to-red-600' 
                    : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                }`}>
                  <p className="text-sm text-white/80">صافي ضريبة القيمة المضافة للفترة</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {netTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-white/80 mt-1">
                    {netTax > 0 ? 'مبلغ واجب السداد للهيئة' : 'مبلغ قابل للاسترداد'}
                  </p>
                  {previousQuarterReport && (
                    <div className="mt-3 pt-3 border-t border-white/30">
                      <p className="text-xs text-white/70">الربع السابق</p>
                      <p className="text-lg font-semibold text-white mt-1">
                        {((previousQuarterReport.local_sales_standard || 0) * 0.15 + (previousQuarterReport.gcc_sales || 0) * 0.15 - ((previousQuarterReport.local_purchases_standard || 0) * 0.15 + (previousQuarterReport.imports_vat_paid || 0) * 0.15 + (previousQuarterReport.imports_reverse_charge || 0) * 0.15)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                </div>



                {/* Target Payment Calculator */}
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 no-print">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-amber-600" />
                      <span className="font-medium text-amber-800">محاكي السداد المستهدف</span>
                    </div>
                    <Switch 
                      checked={autoCalculate} 
                      onCheckedChange={setAutoCalculate}
                    />
                  </div>
                  
                  <p className="text-sm text-slate-600 mb-3">أدخل المبلغ الذي ترغب في سداده:</p>
                  <div className="relative mb-4">
                    <Input
                      type="number"
                      value={targetPayment || ''}
                      onChange={(e) => setTargetPayment(parseFloat(e.target.value) || 0)}
                      className="pl-12 text-left bg-white"
                      dir="ltr"
                      placeholder="0.00"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ريال</span>
                  </div>

                  {autoCalculate && targetPayment > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      {requiredPurchases > 0 ? (
                        <>
                          <div className="p-3 bg-white rounded-lg border border-amber-200">
                            <p className="text-sm text-slate-600">مطلوب مشتريات بضريبة قدرها</p>
                            <p className="text-xl font-bold text-amber-700">
                              {(requiredPurchases * 0.15).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              لتحقيق صافي سداد قدره {targetPayment.toLocaleString('en-US')} ريال
                            </p>
                          </div>
                          
                          <div className="p-3 bg-white rounded-lg border border-amber-200">
                            <p className="text-sm text-slate-600">قيمة المشتريات المطلوبة</p>
                            <p className="text-xl font-bold text-amber-700">
                              {requiredPurchases.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="p-3 bg-white rounded-lg border border-emerald-200">
                          <p className="text-sm text-emerald-700 text-center">
                            المبلغ المستهدف محقق بالفعل ✓
                          </p>
                        </div>
                      )}

                      <Button 
                        onClick={handleAutoFillPurchases}
                        className="w-full bg-amber-600 hover:bg-amber-700 gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        تعبئة المشتريات المحلية تلقائياً
                      </Button>
                    </motion.div>
                  )}
                </div>

                {/* Warning Notice */}
                <div className="p-4 bg-slate-50 rounded-lg border no-print">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-slate-500 mt-0.5" />
                    <div className="text-sm text-slate-600">
                      <p className="font-medium mb-1">تنبيه مهم</p>
                      <p>يرجى التأكد من صحة البيانات المدخلة قبل التقديم. عقوبة التقديم الخاطئ قد تعرضك لغرامات مالية وفق أنظمة الهيئة.</p>
                    </div>
                  </div>
                </div>

                {/* Status Display */}
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 no-print">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-emerald-800">حالة الإقرار</p>
                      <p className="text-xs text-emerald-600">تم التقديم</p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  onClick={handleSave}
                  disabled={saveMutation.isPending || !formData.company_id}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg gap-2 no-print"
                >
                  {saveMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      حفظ الإقرار
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}