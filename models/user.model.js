const supabase = require("../constraint/database");
const bcrypt = require('bcryptjs');

const user = {
	login: async ({ email, password }) => {
		try {
            // Ambil data pengguna berdasarkan email
            const { data: userData, error: userError } = await supabase
                .from('user')
                .select('*')
                .eq('email', email)
                .single();
    
            if (userError) {
                console.error('User Query Error:', userError.message);
                return { status: 'err', msg: 'Error fetching user data' };
            }
    
            if (!userData) {
                console.error('No user data found');
                return { status: 'err', msg: 'User not found' };
            }
    
            // Verifikasi password
            const isPasswordValid = await bcrypt.compare(password, userData.password);
    
            if (!isPasswordValid) {
                console.error('Invalid password');
                return { status: 'err', msg: 'Invalid email or password' };
            }
    
            // Ambil data biodata berdasarkan user ID
            const { data: biodata, error: biodataError } = await supabase
                .from('biodata')
                .select('*')
                .eq('id_user', userData.id)
    
            if (biodataError) {
                console.error('Biodata Query Error:', biodataError.message);
                return { status: 'err', msg: 'Error fetching biodata' };
            }
    
            // Gabungkan data pengguna dan biodata
            const responseData = {
                nama: userData.nama,
                saldo: userData.saldo,
                foto_profil: userData.foto_profil,
                biodata: biodata,
				uuid:userData.id
            };
    
            return { status: 'ok', data: responseData };
        } catch (err) {
            console.error('Login Exception:', err.message);
            return { status: 'err', msg: 'An error occurred during login' };
        }
    },
	addUser: async (data, file) => {
		const { nama, email, password, tanggal_lahir, provinsi, kota, pekerjaan, gender } = data;
		data.foto = "";
		const genderbool = (gender === "Pria");
		console.log(genderbool)
        const hashedpassword = await bcrypt.hash(password, 12)
		if (file && file.size > 0) {
			const pathname = `${nama}`;

			//handle upload file
			const [
				{ error: errUpload },
				{
					data: { publicUrl },
				},
			] = await Promise.all([
				supabase.storage.from("foto_profile").upload(pathname, file.buffer, {
					cacheControl: "3600",
					contentType: file.mimetype,
				}),
				supabase.storage.from("foto_profile").getPublicUrl(pathname),
			]);
			if (errUpload) {
				return { status: "err", msg: errUpload };
			}

			data.foto = publicUrl;
		}

		const { error } = await supabase.from("user").insert([
            {
                nama: nama,
                email: email,
                password: hashedpassword,
                foto_profil: data.foto,
            }
        ]);  
		if (error) {
			return { status: "err", msg: error };
		}
		const {data : id_user, error: errorId }= await supabase
			.from("user")
			.select("id")
			.eq("email", email)
		if(errorId){
			return {status: "err", msg: errorId}
		}
		const iduser = id_user[0].id
		const { error: bioError } = await supabase.from("biodata").insert([
			{
				id_user: iduser,
				tanggal_lahir: tanggal_lahir,
				provinsi: provinsi,
				kota: kota,
				pekerjaan: pekerjaan,
				gender: genderbool, 
			}
		]);
		console.log(iduser)
		if (bioError) {
			return { status: "err", msg: bioError };
		} 
		return { status: "ok", msg: "success add user" };
	},
	updateUser: async (userId, data, file) => {
		const { nama, biodata } = data;
		let updatedData = { nama, biodata };
	
		if (file && file.size > 0) {
			const pathname = `${nama}`;
	
			const [
				{ error: errUpload },
				{
					data: { publicUrl },
				},
			] = await Promise.all([
				supabase.storage.from("foto_profile").upload(pathname, file.buffer, {
					cacheControl: "3600",
					contentType: file.mimetype,
				}),
				supabase.storage.from("foto_profile").getPublicUrl(pathname),
			]);
	
			if (errUpload) {
				return { status: "err", msg: errUpload };
			}
	
			updatedData.foto_profil = publicUrl;
		}
	
		const { error } = await supabase.from("user").update(updatedData).eq("id", userId);
	
		if (error) {
			return { status: "err", msg: error.message };
		}
	
		return { status: "ok", msg: "User updated successfully" };
	}	
};

module.exports = user;