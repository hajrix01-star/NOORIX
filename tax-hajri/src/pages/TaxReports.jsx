import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taxAppClient } from '@/api/taxAppClient';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Plus, FileText, Calendar, Building2, ArrowRight, 
  CheckCircle, Clock, CreditCard, Trash2, Eye, Check, Printer, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const QUARTERS = {
  Q1: 'الربع الأول (يناير - مارس)',
  Q2: 'الربع الثاني (أبريل - يونيو)',
  Q3: 'الربع الثالث (يوليو - سبتمبر)',
  Q4: 'الربع الرابع (أكتوبر - ديسمبر)'
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

const STATUS_CONFIG = {
  submitted: { label: 'تم التقديم', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle }
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

export default function TaxReports() {
  const urlParams = new URLSearchParams(window.location.search);
  const companyIdFromUrl = urlParams.get('company');
  
  const [selectedCompany, setSelectedCompany] = useState(companyIdFromUrl || '');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [filterCompany, setFilterCompany] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterQuarter, setFilterQuarter] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  const queryClient = useQueryClient();

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => taxAppClient.entities.Company.list()
  });

  const { data: allReports = [] } = useQuery({
    queryKey: ['allReports'],
    queryFn: () => taxAppClient.entities.TaxReport.list()
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', selectedCompany, selectedYear],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const companyReports = await taxAppClient.entities.TaxReport.filter({ company_id: selectedCompany });
      return companyReports.filter(r => r.year === parseInt(selectedYear));
    },
    enabled: !!selectedCompany
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => taxAppClient.entities.TaxReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['reports']);
      toast.success('تم حذف الإقرار بنجاح');
    }
  });

  useEffect(() => {
    if (companyIdFromUrl && !selectedCompany) {
      setSelectedCompany(companyIdFromUrl);
    }
  }, [companyIdFromUrl]);

  const selectedCompanyData = companies.find(c => c.id === selectedCompany);
  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  const calculateNetTax = (report) => {
    const outputTax = (
      (report.local_sales_standard || 0) * 0.15 +
      (report.gcc_sales || 0) * 0.15
    );
    const inputTax = (
      (report.local_purchases_standard || 0) * 0.15 +
      (report.imports_vat_paid || 0) * 0.15 +
      (report.imports_reverse_charge || 0) * 0.15
    );
    return outputTax - inputTax;
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredAllReports = allReports.filter(report => {
    const company = companies.find(c => c.id === report.company_id);
    const normalizedQuarter = normalizeQuarter(report.quarter);
    
    if (filterCompany && report.company_id !== filterCompany) return false;
    if (filterYear && report.year.toString() !== filterYear) return false;
    if (filterQuarter && normalizedQuarter !== filterQuarter) return false;
    if (filterStatus && report.status !== filterStatus) return false;
    
    return true;
  }).sort((a, b) => {
    // الترتيب حسب السنة أولاً (الأحدث أولاً)
    if (b.year !== a.year) return b.year - a.year;
    
    // ثم حسب الربع
    const quarterOrder = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
    const quarterA = quarterOrder[normalizeQuarter(a.quarter)] || 0;
    const quarterB = quarterOrder[normalizeQuarter(b.quarter)] || 0;
    return quarterB - quarterA;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
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
          .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          .print-table th {
            background: #f1f5f9;
            padding: 6px;
            text-align: center;
            border: 1px solid #cbd5e1;
            font-weight: 600;
          }
          .print-table td {
            padding: 6px;
            border: 1px solid #e2e8f0;
            text-align: center;
          }
          .quarter-separator {
            border-top: 3px solid #000 !important;
          }
          .print-header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #059669;
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
         {/* Header */}
         <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
           <Link to={createPageUrl('Companies')} className="hover:text-emerald-600">الشركات</Link>
           <ArrowRight className="w-4 h-4 rotate-180" />
           <span className="text-slate-800">التقارير الضريبية</span>
         </div>

         {/* Print Area */}
         <div id="print-area" className="hidden print:block">
           <div className="print-header">
             <h2 className="text-lg font-bold mb-2">تقرير ضريبة القيمة المضافة</h2>
             <p className="text-sm">التقارير المفلترة</p>
           </div>
           <table className="print-table">
             <thead>
               <tr>
                 <th>الشركة</th>
                 <th>الربع</th>
                 <th>السنة</th>
                 <th>المبيعات (ريال)</th>
                 <th>المشتريات (ريال)</th>
                 <th>ضريبة المخرجات</th>
                 <th>ضريبة المدخلات</th>
                 <th>صافي الضريبة</th>
               </tr>
             </thead>
             <tbody>
               {filteredAllReports.map((report, index) => {
                 const company = companies.find(c => c.id === report.company_id);
                 const outputTax = (report.local_sales_standard || 0) * 0.15 + (report.gcc_sales || 0) * 0.15;
                 const inputTax = (report.local_purchases_standard || 0) * 0.15 + (report.imports_vat_paid || 0) * 0.15 + (report.imports_reverse_charge || 0) * 0.15;
                 const netTax = outputTax - inputTax;
                 const totalSales = (report.local_sales_standard || 0) + (report.gcc_sales || 0) + (report.local_sales_zero || 0) + (report.exempt_sales || 0);
                 const totalPurchases = (report.local_purchases_standard || 0) + (report.imports_vat_paid || 0) + (report.imports_reverse_charge || 0) + (report.purchases_zero || 0) + (report.exempt_purchases || 0);
                 const normalizedQuarter = normalizeQuarter(report.quarter);
                 
                 const prevReport = index > 0 ? filteredAllReports[index - 1] : null;
                 const isNewQuarter = prevReport && (
                   normalizeQuarter(prevReport.quarter) !== normalizedQuarter ||
                   prevReport.year !== report.year
                 );
                 
                 return (
                   <tr key={report.id} className={isNewQuarter ? 'quarter-separator' : ''}>
                     <td>{company?.name || 'غير محدد'}</td>
                     <td>{normalizedQuarter}</td>
                     <td>{report.year}</td>
                     <td>{totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                     <td>{totalPurchases.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                     <td>{outputTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                     <td>{inputTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                     <td style={{fontWeight: 'bold', color: netTax > 0 ? '#dc2626' : '#059669'}}>
                       {netTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                     </td>
                   </tr>
                 );
               })}
             </tbody>
           </table>
         </div>

         {/* All Reports Table */}
         <Card className="border-0 shadow-md mb-8 no-print">
           <CardHeader className="pb-3 flex flex-row items-center justify-between">
             <CardTitle className="text-lg">جميع التقارير المقدمة</CardTitle>
             <div className="flex gap-2">
               <Button onClick={handlePrint} variant="outline" className="gap-2">
                 <Printer className="w-4 h-4" />
                 طباعة
               </Button>
             </div>
           </CardHeader>
           <CardContent>
             {/* Filters */}
             <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-lg">
               <div>
                 <Label className="text-xs mb-2 block">الشركة</Label>
                 <select 
                   value={filterCompany}
                   onChange={(e) => setFilterCompany(e.target.value)}
                   className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm"
                 >
                   <option value="">جميع الشركات</option>
                   {companies.map(c => (
                     <option key={c.id} value={c.id}>{c.name}</option>
                   ))}
                 </select>
               </div>
               <div>
                 <Label className="text-xs mb-2 block">السنة</Label>
                 <select 
                   value={filterYear}
                   onChange={(e) => setFilterYear(e.target.value)}
                   className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm"
                 >
                   <option value="">جميع السنوات</option>
                   {years.map(y => (
                     <option key={y} value={y}>{y}</option>
                   ))}
                 </select>
               </div>
               <div>
                 <Label className="text-xs mb-2 block">الربع</Label>
                 <select 
                   value={filterQuarter}
                   onChange={(e) => setFilterQuarter(e.target.value)}
                   className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm"
                 >
                   <option value="">جميع الأرباع</option>
                   <option value="Q1">Q1</option>
                   <option value="Q2">Q2</option>
                   <option value="Q3">Q3</option>
                   <option value="Q4">Q4</option>
                 </select>
               </div>
               <div>
                 <Label className="text-xs mb-2 block">الحالة</Label>
                 <select 
                   value={filterStatus}
                   onChange={(e) => setFilterStatus(e.target.value)}
                   className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm"
                 >
                   <option value="">جميع الحالات</option>
                   <option value="submitted">تم التقديم</option>
                 </select>
               </div>
             </div>

             <div className="overflow-x-auto">
               <table className="w-full">
                 <thead className="bg-slate-50 border-b">
                   <tr>
                     <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">الشركة</th>
                     <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">الربع</th>
                     <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">السنة</th>
                     <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">المبيعات</th>
                     <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">المشتريات</th>
                     <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">ضريبة المخرجات</th>
                     <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">ضريبة المدخلات</th>
                     <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">صافي الضريبة</th>
                     <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">الحالة</th>
                     <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">الإجراءات</th>
                   </tr>
                 </thead>
                 <tbody>
                   {filteredAllReports.length === 0 ? (
                     <tr>
                       <td colSpan="8" className="px-6 py-8 text-center text-slate-500">لا توجد تقارير مقدمة</td>
                     </tr>
                   ) : (
                     filteredAllReports.map((report, index) => {
                       const company = companies.find(c => c.id === report.company_id);
                       const outputTax = (report.local_sales_standard || 0) * 0.15 + (report.gcc_sales || 0) * 0.15;
                       const inputTax = (report.local_purchases_standard || 0) * 0.15 + (report.imports_vat_paid || 0) * 0.15 + (report.imports_reverse_charge || 0) * 0.15;
                       const netTax = outputTax - inputTax;

                       const totalSales = (report.local_sales_standard || 0) + (report.gcc_sales || 0) + (report.local_sales_zero || 0) + (report.exempt_sales || 0);
                       const totalPurchases = (report.local_purchases_standard || 0) + (report.imports_vat_paid || 0) + (report.imports_reverse_charge || 0) + (report.purchases_zero || 0) + (report.exempt_purchases || 0);
                       const normalizedQuarter = normalizeQuarter(report.quarter);

                       // Check if this is a new quarter
                       const prevReport = index > 0 ? filteredAllReports[index - 1] : null;
                       const isNewQuarter = prevReport && (
                         normalizeQuarter(prevReport.quarter) !== normalizedQuarter ||
                         prevReport.year !== report.year
                       );

                       return (
                         <tr key={report.id} className={`border-b hover:bg-slate-50 transition-colors ${isNewQuarter ? 'border-t-4 border-t-black' : ''}`}>
                           <td className="px-6 py-4 text-sm font-medium text-slate-800">{company?.name || 'غير محدد'}</td>
                           <td className="px-6 py-4 text-sm text-slate-600">{normalizedQuarter}</td>
                           <td className="px-6 py-4 text-sm text-slate-600">{report.year}</td>
                           <td className="px-6 py-4 text-sm text-center text-slate-600">{totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال</td>
                           <td className="px-6 py-4 text-sm text-center text-slate-600">{totalPurchases.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال</td>
                           <td className="px-6 py-4 text-sm text-center text-slate-600">{outputTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال</td>
                           <td className="px-6 py-4 text-sm text-center text-slate-600">{inputTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال</td>
                           <td className={`px-6 py-4 text-sm text-center font-semibold ${netTax > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                             {netTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                           </td>
                           <td className="px-6 py-4 text-center">
                             <Badge className="bg-emerald-100 text-emerald-800">
                               تم التقديم
                             </Badge>
                           </td>
                           <td className="px-6 py-4 text-center space-x-2">
                             <Link to={createPageUrl('TaxForm') + `?id=${report.id}`} className="inline">
                               <Button size="sm" variant="outline" className="text-xs gap-1">
                                 <Eye className="w-3 h-3" />
                               </Button>
                             </Link>
                             <Button 
                               size="sm"
                               variant="ghost"
                               onClick={() => deleteMutation.mutate(report.id)}
                               className="text-red-600 hover:bg-red-50 text-xs"
                             >
                               <Trash2 className="w-3 h-3" />
                             </Button>
                           </td>
                         </tr>
                       );
                     })
                   )}
                 </tbody>
               </table>
             </div>
           </CardContent>
         </Card>

         <div className="mb-8 no-print">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">التقارير الضريبية</h1>
              <p className="text-slate-500 mt-1">إدارة إقرارات ضريبة القيمة المضافة</p>
            </div>
            
            {selectedCompany && (
              <Link to={createPageUrl('TaxForm') + `?company=${selectedCompany}&year=${selectedYear}`}>
                <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2 shadow-lg shadow-emerald-200">
                  <Plus className="w-4 h-4" />
                  إقرار جديد
                </Button>
              </Link>
            )}
          </div>

          {/* Company Tabs */}
          <div className="mb-4">
            <p className="text-sm font-medium text-slate-600 mb-3">اختر الشركة:</p>
            <div className="flex flex-wrap gap-2">
              {companies.map(company => (
                <Button
                  key={company.id}
                  onClick={() => setSelectedCompany(company.id)}
                  variant={selectedCompany === company.id ? 'default' : 'outline'}
                  className={selectedCompany === company.id 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'hover:border-emerald-300'}
                >
                  {selectedCompany === company.id && <Check className="w-4 h-4 ml-2" />}
                  {company.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Year Tabs */}
          {selectedCompany && (
            <div>
              <p className="text-sm font-medium text-slate-600 mb-3">اختر السنة:</p>
              <div className="flex flex-wrap gap-2">
                {years.map(year => (
                  <Button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    variant={selectedYear === year ? 'default' : 'outline'}
                    className={selectedYear === year 
                      ? 'bg-emerald-600 hover:bg-emerald-700' 
                      : 'hover:border-emerald-300'}
                  >
                    {selectedYear === year && <Check className="w-4 h-4 ml-2" />}
                    {year}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {!selectedCompany ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">اختر شركة</h3>
            <p className="text-slate-500">قم باختيار شركة من القائمة لعرض تقاريرها الضريبية</p>
          </motion.div>
        ) : isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-slate-200 rounded w-1/4 mb-4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">لا توجد تقارير</h3>
            <p className="text-slate-500 mb-6">لم يتم إنشاء أي إقرار ضريبي لهذه الشركة في سنة {selectedYear}</p>
            <Link to={createPageUrl('TaxForm') + `?company=${selectedCompany}&year=${selectedYear}`}>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Plus className="w-4 h-4" />
                إنشاء إقرار جديد
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {/* Company Info Card */}
            {selectedCompanyData && (
              <Card className="border-0 shadow-md mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Building2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">{selectedCompanyData.name}</h2>
                      {selectedCompanyData.tax_number && (
                        <p className="text-slate-500">الرقم الضريبي: {selectedCompanyData.tax_number}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reports Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">الربع</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">السنة</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">ضريبة المخرجات</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">ضريبة المدخلات</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">صافي الضريبة</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">الحالة</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => {
                      const outputTax = (report.local_sales_standard || 0) * 0.15 + (report.gcc_sales || 0) * 0.15;
                      const inputTax = (report.local_purchases_standard || 0) * 0.15 + (report.imports_vat_paid || 0) * 0.15 + (report.imports_reverse_charge || 0) * 0.15;
                      const netTax = outputTax - inputTax;

                      return (
                        <tr key={report.id} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-800 font-medium">{QUARTERS[normalizeQuarter(report.quarter)]}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{report.year}</td>
                          <td className="px-6 py-4 text-sm text-center text-slate-600">{outputTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال</td>
                          <td className="px-6 py-4 text-sm text-center text-slate-600">{inputTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال</td>
                          <td className={`px-6 py-4 text-sm text-center font-semibold ${netTax > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {netTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Badge className="bg-emerald-100 text-emerald-800">
                              تم التقديم
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-center space-x-2">
                            <Link to={createPageUrl('TaxForm') + `?id=${report.id}`} className="inline">
                              <Button size="sm" variant="outline" className="text-xs gap-1">
                                <Eye className="w-3 h-3" />
                                عرض
                              </Button>
                            </Link>
                            <Button 
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(report.id)}
                              className="text-red-600 hover:bg-red-50 text-xs"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, index) => {
                  const report = reports.find(r => r.quarter === quarter);
                  const StatusIcon = report ? STATUS_CONFIG[report.status]?.icon || Clock : null;
                  
                  return (
                    <motion.div
                      key={quarter}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className={`border-0 shadow-md overflow-hidden transition-all hover:shadow-lg ${
                        report ? '' : 'opacity-60'
                      }`}>
                        <div className={`h-1.5 ${
                          report 
                            ? report.status === 'paid' 
                              ? 'bg-emerald-500' 
                              : report.status === 'submitted'
                                ? 'bg-blue-500'
                                : 'bg-slate-300'
                            : 'bg-slate-200'
                        }`}></div>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                report ? 'bg-emerald-100' : 'bg-slate-100'
                              }`}>
                                <Calendar className={`w-5 h-5 ${
                                  report ? 'text-emerald-600' : 'text-slate-400'
                                }`} />
                              </div>
                              <div>
                                <CardTitle className="text-base">{quarter}</CardTitle>
                                <p className="text-sm text-slate-500">{selectedYear}</p>
                              </div>
                            </div>
                            {report && (
                              <Badge className={STATUS_CONFIG.submitted.color}>
                                <CheckCircle className="w-3 h-3 ml-1" />
                                تم التقديم
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {report ? (
                            <>
                              <div className="grid grid-cols-2 gap-4 py-4 border-t mt-2">
                                <div>
                                  <p className="text-sm text-slate-500">إجمالي المبيعات</p>
                                  <p className="text-lg font-bold text-blue-600">
                                    {((report.local_sales_standard || 0) + (report.gcc_sales || 0) + (report.local_sales_zero || 0) + (report.exempt_sales || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-slate-500">إجمالي المشتريات</p>
                                  <p className="text-lg font-bold text-emerald-600">
                                    {((report.local_purchases_standard || 0) + (report.imports_vat_paid || 0) + (report.imports_reverse_charge || 0) + (report.purchases_zero || 0) + (report.exempt_purchases || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 py-4">
                                <div>
                                  <p className="text-sm text-slate-500">ضريبة المخرجات</p>
                                  <p className="text-lg font-bold text-slate-800">
                                    {((report.local_sales_standard || 0) * 0.15 + (report.gcc_sales || 0) * 0.15).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-slate-500">ضريبة المدخلات</p>
                                  <p className="text-lg font-bold text-slate-800">
                                    {((report.local_purchases_standard || 0) * 0.15 + (report.imports_vat_paid || 0) * 0.15).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                                  </p>
                                </div>
                              </div>
                              <div className={`p-3 rounded-lg ${
                                calculateNetTax(report) > 0 
                                  ? 'bg-red-50 border border-red-100' 
                                  : 'bg-emerald-50 border border-emerald-100'
                              }`}>
                                <p className="text-sm text-slate-600">صافي الضريبة المستحقة</p>
                                <p className={`text-xl font-bold ${
                                  calculateNetTax(report) > 0 ? 'text-red-600' : 'text-emerald-600'
                                }`}>
                                  {calculateNetTax(report).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال
                                </p>
                              </div>
                              <div className="flex gap-2 mt-4">
                                <Link 
                                  to={createPageUrl('TaxForm') + `?id=${report.id}`}
                                  className="flex-1"
                                >
                                  <Button variant="outline" className="w-full gap-2">
                                    <Eye className="w-4 h-4" />
                                    عرض وتعديل
                                  </Button>
                                </Link>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => deleteMutation.mutate(report.id)}
                                  className="hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="py-4">
                              <p className="text-sm text-slate-500 mb-4">لم يتم إنشاء إقرار لهذا الربع</p>
                              <Link to={createPageUrl('TaxForm') + `?company=${selectedCompany}&year=${selectedYear}&quarter=${quarter}`}>
                                <Button variant="outline" className="w-full gap-2 border-dashed">
                                  <Plus className="w-4 h-4" />
                                  إنشاء إقرار
                                </Button>
                              </Link>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}