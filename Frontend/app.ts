import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  
  autenticado: boolean = false;
  credenciales = { usuario: '', password: '' };
  vistaActual: string = 'dashboard'; 
  editando: boolean = false;
  
  filtroTurno: string = '';
  terminoBusqueda: string = ''; 
  paginaActual: number = 0;
  tamañoPagina: number = 5;
  totalPaginas: number = 0;
  nuevoMiembro: any = { id: null, dni: '', nombre: '', apellido: '', edad: null, turno: '', plan: null, metodoPago: '' };
  miembros: any[] = []; 
  
  totalMiembros: number = 0;
  miembrosActivos: number = 0;
  turnoManana: number = 0;
  turnoTarde: number = 0;
  turnoNoche: number = 0;

  planes: any[] = [];
  nuevoPlan: any = { id: null, nombre: '', duracionDias: null, precio: null };
  editandoPlan: boolean = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {}

  iniciarSesion() {
    if (this.credenciales.usuario === 'admin' && this.credenciales.password === 'admin123') {
      this.autenticado = true;
      this.vistaActual = 'dashboard';
      this.obtenerMiembros(); 
      this.obtenerPlanes(); 
      this.calcularEstadisticas();
      
      Swal.fire({
        title: '¡Bienvenido!', text: 'Acceso autorizado al sistema.', icon: 'success',
        background: '#292D32', color: '#E0E5EC', showConfirmButton: false, timer: 1500
      });
    } else {
      Swal.fire({ title: 'Acceso Denegado', icon: 'error', background: '#292D32', color: '#E0E5EC' });
    }
  }

  cerrarSesion() {
    this.autenticado = false;
    this.credenciales = { usuario: '', password: '' };
    this.miembros = []; 
    this.planes = [];
  }

  cambiarVista(vista: string) {
    this.vistaActual = vista;
    if (vista === 'formulario' && !this.editando) this.cancelarEdicion();
    if (vista === 'formularioPlan' && !this.editandoPlan) this.cancelarEdicionPlan();
  }

  formatearTurno(turno: string): string {
    if (turno === 'MANANA') return 'Mañana';
    if (turno === 'TARDE') return 'Tarde';
    if (turno === 'NOCHE') return 'Noche';
    return turno || '-';
  }

  // --- LÓGICA DE VENCIMIENTO PARA LA INTERFAZ ---
  estadoMembresia(fechaVencimiento: string): string {
    if (!fechaVencimiento) return 'SIN PLAN';
    const hoy = new Date().toISOString().split('T')[0]; // Compara AAAA-MM-DD
    return fechaVencimiento >= hoy ? 'VIGENTE' : 'VENCIDO';
  }

  obtenerMiembros() {
    let url = `http://localhost:8080/api/miembros?page=${this.paginaActual}&size=${this.tamañoPagina}`;
    if (this.filtroTurno) url += `&turno=${this.filtroTurno}`;
    if (this.terminoBusqueda) url += `&busqueda=${this.terminoBusqueda}`;
    
    this.http.get<any>(url).subscribe({
      next: (respuesta) => {
        this.miembros = respuesta.content; 
        this.totalPaginas = respuesta.totalPages;
        this.cdr.detectChanges();
      }
    });
  }

  cambiarPagina(nuevaPagina: number) {
    if (nuevaPagina >= 0 && nuevaPagina < this.totalPaginas) {
      this.paginaActual = nuevaPagina;
      this.obtenerMiembros();
    }
  }

  calcularEstadisticas() {
    this.http.get<any>('http://localhost:8080/api/miembros/estadisticas').subscribe(stats => {
      this.totalMiembros = stats.total;
      this.miembrosActivos = stats.activos; // ¡AHORA USA EL CALCULO REAL!
      this.turnoManana = stats.manana;
      this.turnoTarde = stats.tarde;
      this.turnoNoche = stats.noche;
      this.cdr.detectChanges();
    });
  }

  exportarPDF() {
    let url = `http://localhost:8080/api/miembros?page=0&size=1000`;
    if (this.filtroTurno) url += `&turno=${this.filtroTurno}`;
    
    this.http.get<any>(url).subscribe(respuesta => {
      const doc = new jsPDF();
      doc.text('Reporte Oficial - Spartacus GYM', 14, 15);
      
      const datosTabla = respuesta.content.map((m: any) => [
        m.dni, 
        `${m.nombre} ${m.apellido}`, 
        m.edad, 
        this.formatearTurno(m.turno), 
        m.plan ? m.plan.nombre : 'Sin Plan',
        this.estadoMembresia(m.fechaVencimiento) // Agregamos el estado al PDF
      ]);
      
      autoTable(doc, {
        head: [['DNI', 'Nombre Completo', 'Edad', 'Turno', 'Plan', 'Estado']],
        body: datosTabla,
        startY: 20,
        headStyles: { fillColor: [41, 45, 50] } 
      });
      doc.save('Reporte_SpartacusGYM.pdf');
    });
  }

  guardarMiembro() {
    const url = this.editando ? `http://localhost:8080/api/miembros/${this.nuevoMiembro.id}` : 'http://localhost:8080/api/miembros';
    const peticion = this.editando ? this.http.put(url, this.nuevoMiembro) : this.http.post(url, this.nuevoMiembro);

    peticion.subscribe({
      next: () => {
        Swal.fire({ title: '¡Éxito!', icon: 'success', background: '#292D32', color: '#E0E5EC' });
        this.cancelarEdicion();
        this.paginaActual = 0; 
        this.obtenerMiembros();
        this.calcularEstadisticas();
        this.cambiarVista('lista');
      },
      error: () => Swal.fire({ title: 'Error', text: 'Datos inválidos', icon: 'error', background: '#292D32', color: '#E0E5EC' })
    });
  }

  editarMiembro(miembro: any) {
    this.editando = true;
    this.nuevoMiembro = { ...miembro }; 
    this.cambiarVista('formulario'); 
  }

  cancelarEdicion() {
    this.editando = false;
    this.nuevoMiembro = { id: null, dni: '', nombre: '', apellido: '', edad: null, turno: '', plan: null, metodoPago: '' };
  }

  eliminarMiembro(id: number) {
    Swal.fire({
      title: '¿Dar de baja?', icon: 'warning', showCancelButton: true,
      background: '#292D32', color: '#E0E5EC', confirmButtonText: 'Sí'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`http://localhost:8080/api/miembros/${id}`).subscribe(() => {
          Swal.fire({ title: '¡Dado de baja!', icon: 'success', background: '#292D32', color: '#E0E5EC' });
          this.obtenerMiembros();
          this.calcularEstadisticas();
        });
      }
    });
  }

  compararPlanes(p1: any, p2: any): boolean {
    return p1 && p2 ? p1.id === p2.id : p1 === p2;
  }

  obtenerPlanes() {
    this.http.get<any[]>('http://localhost:8080/api/planes').subscribe(respuesta => {
      this.planes = respuesta;
      this.cdr.detectChanges();
    });
  }

  guardarPlan() {
    const url = this.editandoPlan ? `http://localhost:8080/api/planes/${this.nuevoPlan.id}` : 'http://localhost:8080/api/planes';
    const peticion = this.editandoPlan ? this.http.put(url, this.nuevoPlan) : this.http.post(url, this.nuevoPlan);

    peticion.subscribe({
      next: () => {
        Swal.fire({ title: '¡Éxito!', icon: 'success', background: '#292D32', color: '#E0E5EC' });
        this.cancelarEdicionPlan();
        this.obtenerPlanes();
        this.cambiarVista('planes');
      },
      error: () => Swal.fire({ title: 'Error', text: 'Datos del plan inválidos', icon: 'error', background: '#292D32', color: '#E0E5EC' })
    });
  }

  editarPlan(plan: any) {
    this.editandoPlan = true;
    this.nuevoPlan = { ...plan }; 
    this.cambiarVista('formularioPlan'); 
  }

  cancelarEdicionPlan() {
    this.editandoPlan = false;
    this.nuevoPlan = { id: null, nombre: '', duracionDias: null, precio: null };
  }

  eliminarPlan(id: number) {
    Swal.fire({
      title: '¿Eliminar Plan?', text: 'Esta acción no se puede deshacer', icon: 'warning', showCancelButton: true,
      background: '#292D32', color: '#E0E5EC', confirmButtonText: 'Sí, eliminar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`http://localhost:8080/api/planes/${id}`).subscribe(() => {
          Swal.fire({ title: '¡Plan Eliminado!', icon: 'success', background: '#292D32', color: '#E0E5EC' });
          this.obtenerPlanes();
        });
      }
    });
  }
}