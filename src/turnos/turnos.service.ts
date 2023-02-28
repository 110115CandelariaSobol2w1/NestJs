import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm/repository/Repository';
import { turno } from './turno.entity';
import {
  DataSource,
  EntityManager,
  getConnection,
  getConnectionManager,
  getRepository,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
} from 'typeorm';
import { consultarTurnosDto } from './DTO/consultar-turnos.dto';
import { registrarTurnoDto } from './DTO/registrar-turno.dto';
import { pet } from 'src/pets/pet.entity';
import { terminarCitaDto } from './DTO/terminar-cita.dto';
import { turnosDisponiblesDto } from './DTO/turnos-disponibles.dto';
import { historial } from '../historial/historial.entity';

@Injectable()
export class TurnosService {
  constructor(
    @InjectRepository(turno) private turnoRepository: Repository<turno>,
    @InjectRepository(pet) private petRepository: Repository<pet>,
    @InjectRepository(historial) private historialRepository: Repository<historial>,
    private readonly entityManager: EntityManager,
  ) {}

  async findAll(): Promise<turno[]> {
    return await this.turnoRepository.find();
  }

  async findTurnosByMascota() {
    return await this.turnoRepository.find();
  }

  //1- En usuarios service. (Ver psicologos)

  //2- Ver turnos disponibles LISTO
  async getHorariosDisponibles(
    turnosDisponibles: turnosDisponiblesDto,
  ): Promise<Date[]> {
    //primero obtengo el tipo para ver el tiempo de la consulta
    const obtengoTipo = await await this.petRepository.find({
      select: {
        Tipo: true,
      },
      where: {
        IdMascota: turnosDisponibles.IdMascota,
      },
    });
    const tipo = obtengoTipo[0].Tipo;
    const duracion = tipo === 'gato' ? 45 : 30; // duración según el tipo de mascota
    const fechaInicio = new Date(turnosDisponibles.fecha); // convertir la fecha a un objeto Date
    fechaInicio.setHours(9, 0, 0, 0); // establecer la hora de inicio de la agenda
    const fechaFin = new Date(turnosDisponibles.fecha);
    fechaFin.setHours(18, 0, 0, 0); // establecer la hora de fin de la agenda

    //obtengo los turnos programados para esa fecha
    const turnos = await this.turnoRepository.find({
      where: {
        Fecha_inicio: fechaInicio,
        IdPsicologo: turnosDisponibles.IdPsicologo,
      },
    });

    const horariosDisponibles = []; //creo array para guardar los turnos disponibles
    let hora = fechaInicio;
    while (hora <= fechaFin) {
      // verificar si la hora está disponible
      const horaFin = new Date(hora.getTime() + duracion * 60000);
      const disponible = !turnos.some(
        (turno) => turno.Fecha_inicio <= hora && turno.Fecha_fin >= horaFin,
      );
      if (disponible) {
        horariosDisponibles.push(new Date(hora));
      }
      // avanzar a la siguiente hora
      hora = new Date(hora.getTime() + 15 * 60000); // avanzar en bloques de 15 minutos
    }
    return horariosDisponibles;
  }

  //3- Registrar un turno
  async register(nuevoTurno: registrarTurnoDto) {
    //primero obtengo el tipo para ver el tiempo de la consulta
    const obtengoTipo = await await this.petRepository.find({
      select: {
        Tipo: true,
      },
      where: {
        IdMascota: nuevoTurno.IdMascota,
      },
    });
    const Tipo = obtengoTipo[0].Tipo;
    const Fecha_inicio = new Date(nuevoTurno.Fecha_inicio);
    if (Tipo === 'perro') {
      console.log('el tiempo de la consulta es 30m');
      //Seteo la fecha fin segun el tipo de animal
      const nuevaFechaFin = new Date(Fecha_inicio.getTime() + 30 * 60000);
      nuevoTurno.Fecha_fin = nuevaFechaFin;
    } else if (Tipo === 'gato') {
      console.log('el tiempo de la consulta es 45m');
      //Seteo la fecha fin segun el tipo de animal
      const nuevaFechaFin = new Date(Fecha_inicio.getTime() + 45 * 60000);
      nuevoTurno.Fecha_fin = nuevaFechaFin;
    }

    //verifico que la mascota no tenga un turno dado
    const verificoTurno = await await this.turnoRepository.count({
      where: {
        IdMascota: nuevoTurno.IdMascota,
        IdEstado: 1,
      },
    });
    const turno = verificoTurno;
    console.log(turno + 'cantidad de turnos');
    console.log(turno);
    if (turno == 0) {
      //Si la mascota no tiene un turno dado verifico si hay lugar entre la fecha de inicio y fin
      console.log('verificando disponibilidad');

      const verificacion = await this.turnoRepository.count({
        where: {
          Fecha_inicio: LessThanOrEqual(nuevoTurno.Fecha_fin),
          Fecha_fin: MoreThanOrEqual(nuevoTurno.Fecha_inicio),
        },
      });

      // const verificacion = await this.entityManager.query(`SELECT COUNT(*) verificacion
      //                                                     FROM Turnos t
      //                                                     WHERE Fecha_inicio < '${nuevoTurno.Fecha_fin.toISOString()}' AND Fecha_fin >  '${Fecha_inicio.toISOString()}'`);
      const verificacionLugar = verificacion;

      if (verificacionLugar == 0) {
        console.log('hay lugar en las fechas seleccionadas');
        const registrandoTurno = this.turnoRepository.create({
          IdMascota: nuevoTurno.IdMascota,
          Fecha_inicio: nuevoTurno.Fecha_inicio,
          Fecha_fin: nuevoTurno.Fecha_fin, //no me toma la nueva fecha de fin.
          IdEstado: nuevoTurno.IdEstado,
          IdPsicologo: nuevoTurno.IdPsicologo,
        });
        await this.turnoRepository.save(registrandoTurno);
        // const registroTurno = await this.entityManager.query(`insert into Turnos (IdMascota, Fecha_inicio, Fecha_fin, IdEstado, IdPsicologo) values (${nuevoTurno.IdMascota}, '${Fecha_inicio.toISOString()}', '${nuevoTurno.Fecha_fin.toISOString()}', 1, ${nuevoTurno.IdPsicologo})`)
        return 'registrando turno';
      } else {
        return ' no hay lugar en la fecha y horario solicitado';
      }
    } else {
      return 'ERROR: tiene turnos activos';
    }
  }

  //4- ver mis turnos TENGO QUE HACER LAS RELACIONES
  async verTurnos(IdUsuario: number): Promise<any> {
    const result = await this.entityManager
      .query(`SELECT IdTurno, Fecha_inicio, Fecha_fin, IdEstado, Nombre, IdCliente 
    FROM Turnos t 
    JOIN Mascotas m ON t.IdMascota = m.IdMascota 
    JOIN Usuarios u ON m.IdCliente = u.IdUsuario 
    WHERE IdEstado = 1 AND IdCliente = ${IdUsuario}`);
    return result;

    //   const result = await this.entityManager.createQueryBuilder()
    //   .select(["Turnos.IdTurno", "Turnos.Fecha_inicio", "Turnos.Fecha_fin", "Turnos.IdEstado", "Mascotas.Nombre", "Mascotas.IdCliente"])
    //   .from("Turnos", "Turnos")
    //   .innerJoin("Turnos.IdMascota", "Mascotas.IdMascota")
    //   .innerJoin("Mascotas.cliente", "Usuarios")
    //   .where("Turnos.IdEstado = :idEstado AND Mascotas.IdCliente = :idCliente", { idEstado: 1, idCliente: IdUsuario })
    //   .getRawMany();
    // return result;
  }

  //5- cencelar un turno LISTO
  async cancelarTurno(IdTurno: number): Promise<any> {
    const result = await this.turnoRepository.update(
      { IdTurno: IdTurno },
      { IdEstado: 3 },
    );
    // const result = await this.entityManager.query(`UPDATE Turnos
    // SET IdEstado = 3
    // WHERE IdTurno = ${IdTurno};`);
    return 'Turno cancelado con exito';
  }

  //6-ver informacion de la mascota, con turnos e historial
  async infoMascotaTurno(IdMascota: number): Promise<any> {
    const result = await this.entityManager
      .query(`select m.IdMascota, m.IdCliente, m.Nombre, m.Tipo, t.IdTurno, t.Fecha_inicio, t.Fecha_fin, h.descripcion
    from Mascotas m join Turnos t on m.IdMascota = t.IdMascota join Historial h on t.IdMascota = h.IdMascota
    where m.IdMascota = ${IdMascota}`);

    return result;
  }

  //7- Ver mis citas (Admin y psicologo) LISTO

  async consultarTurnos(turno: consultarTurnosDto) {
    // const result = await this.entityManager.query(
    //   `select * from turnos where IdPsicologo = ${turno.IdPsicologo} and CAST(Fecha_inicio AS date) = CONVERT(date, '${turno.fecha}', 23)`,
    // );
    const IdPsicologo = turno.IdPsicologo;
    const fecha = turno.fecha;
    const queryBuilder = this.turnoRepository
      .createQueryBuilder()
      .where('IdPsicologo = :IdPsicologo', { IdPsicologo })
      .andWhere(`CAST(Fecha_inicio AS date) = CAST(:fecha AS date)`, { fecha });

    const turnos = await queryBuilder.getMany();
    return turnos;
  }

  //8- terminar cita y cargar el historial clinico (Admin y psicologo) LISTO

  async terminarCita(turno: terminarCitaDto) {
    // const result = await this.entityManager.query(`begin transaction
    // update Turnos set IdEstado = 3 where IdTurno = ${turno.IdTurno}
    // insert into Historial (IdMascota, fecha, descripcion) values (${turno.IdMascota}, GETDATE(), '${turno.descripcion}')
    // commit transaction`);

    // console.log(turno.IdTurno, turno.IdMascota, turno.descripcion);

    //return result;

    const IdEstado = 3;
    const IdTurno = turno.IdTurno;

    const queryBuilder = this.turnoRepository
      .createQueryBuilder()
      .update(turno)
      .set({IdEstado: IdEstado})
      .where('IdTurno = :IdTurno', {IdTurno})
      .execute();

      const IdMascota = turno.IdMascota
      const fecha = new Date();
      const descripcion = turno.descripcion;

      const queryhistorial = this.historialRepository
      .createQueryBuilder()
      .insert()
      .into(historial)
      .values
      ({
        IdMascota : IdMascota,
        fecha: fecha,
        Descripcion : descripcion,
      })
      .execute();
  

  }

  //obtengo tipo de mascota

  async tipoMascota(IdMascota: number) {
    return await this.petRepository.findOne({
      where: {
        IdMascota: IdMascota,
      },
    });
  }
}