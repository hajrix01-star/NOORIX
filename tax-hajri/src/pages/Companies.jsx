import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taxAppClient } from '@/api/taxAppClient';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Plus, Edit2, Trash2, FileText, Phone, Mail, MapPin, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Companies() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    tax_number: '',
    commercial_register: '',
    address: '',
    phone: '',
    email: ''
  });

  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => taxAppClient.entities.Company.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => taxAppClient.entities.Company.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['companies']);
      toast.success('تم إضافة الشركة بنجاح');
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => taxAppClient.entities.Company.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['companies']);
      toast.success('تم تحديث بيانات الشركة بنجاح');
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => taxAppClient.entities.Company.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['companies']);
      toast.success('تم حذف الشركة بنجاح');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      tax_number: '',
      commercial_register: '',
      address: '',
      phone: '',
      email: ''
    });
    setEditingCompany(null);
    setIsOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name || '',
      tax_number: company.tax_number || '',
      commercial_register: company.commercial_register || '',
      address: company.address || '',
      phone: company.phone || '',
      email: company.email || ''
    });
    setIsOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">إدارة الشركات</h1>
            <p className="text-slate-500 mt-1">قم بإضافة وإدارة شركاتك لإنشاء تقارير ضريبة القيمة المضافة</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg shadow-emerald-200"
                onClick={() => {
                  setEditingCompany(null);
                  setFormData({
                    name: '',
                    tax_number: '',
                    commercial_register: '',
                    address: '',
                    phone: '',
                    email: ''
                  });
                }}
              >
                <Plus className="w-4 h-4" />
                إضافة شركة
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right text-xl">
                  {editingCompany ? 'تعديل الشركة' : 'إضافة شركة جديدة'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>اسم الشركة *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="أدخل اسم الشركة"
                    required
                    className="text-right"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الرقم الضريبي</Label>
                    <Input
                      value={formData.tax_number}
                      onChange={(e) => setFormData({...formData, tax_number: e.target.value})}
                      placeholder="300000000000003"
                      className="text-right"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>السجل التجاري</Label>
                    <Input
                      value={formData.commercial_register}
                      onChange={(e) => setFormData({...formData, commercial_register: e.target.value})}
                      placeholder="1234567890"
                      className="text-right"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>العنوان</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="المدينة - الحي - الشارع"
                    className="text-right"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="05xxxxxxxx"
                      className="text-right"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="email@company.com"
                      type="email"
                      className="text-left"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    {editingCompany ? 'حفظ التعديلات' : 'إضافة الشركة'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Companies Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-slate-200 rounded w-3/4 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : companies.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">لا توجد شركات</h3>
            <p className="text-slate-500 mb-6">ابدأ بإضافة شركتك الأولى لإنشاء تقارير ضريبة القيمة المضافة</p>
            <Button 
              onClick={() => setIsOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              إضافة شركة جديدة
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {companies.map((company, index) => (
                <motion.div
                  key={company.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md overflow-hidden">
                    <div className="h-2 bg-gradient-to-l from-emerald-500 to-emerald-600"></div>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{company.name}</CardTitle>
                            {company.tax_number && (
                              <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                <Hash className="w-3 h-3" />
                                {company.tax_number}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {company.address && (
                        <p className="text-sm text-slate-600 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {company.address}
                        </p>
                      )}
                      {company.phone && (
                        <p className="text-sm text-slate-600 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400" />
                          {company.phone}
                        </p>
                      )}
                      {company.email && (
                        <p className="text-sm text-slate-600 flex items-center gap-2" dir="ltr">
                          <Mail className="w-4 h-4 text-slate-400" />
                          {company.email}
                        </p>
                      )}
                      
                      <div className="flex gap-2 pt-4 border-t mt-4">
                        <Link to={createPageUrl('TaxReports') + `?company=${company.id}`} className="flex-1">
                          <Button variant="outline" className="w-full gap-2 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200">
                            <FileText className="w-4 h-4" />
                            التقارير الضريبية
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEdit(company)}
                          className="hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => deleteMutation.mutate(company.id)}
                          className="hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}