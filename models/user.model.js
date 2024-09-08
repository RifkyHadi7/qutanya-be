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
                .single();
    
            if (biodataError) {
                console.error('Biodata Query Error:', biodataError.message);
                return { status: 'err', msg: 'Error fetching biodata' };
            }
    
            // Gabungkan data pengguna dan biodata
            const responseData = {
                nama: userData.nama,
                saldo: userData.saldo,
                foto_profil: userData.foto_profil,
                biodata: biodata
            };
    
            return { status: 'ok', msg: 'Login successful', data: responseData };
        } catch (err) {
            console.error('Login Exception:', err.message);
            return { status: 'err', msg: 'An error occurred during login' };
        }
    },
	addUser: async (data, file) => {
		const { nama, email } = data;
		data.foto = "";
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
                password: data.password,
                foto_profil: data.foto,
            }
        ]);  
		if (error) {
			return { status: "err", msg: error };
		}
		return { status: "ok", msg: "success add user" };
	},
	updateUser: async (data, { nim }) => {
		const { id_proker } = data;
		delete data.id_proker;
		console.log(nim);
		const { error } = await supabase
			.from("motion24_anggotaBEM")
			.update(data)
			.eq("nim", nim);
		if (error) {
			return { status: "err", msg: error };
		}
		if (id_proker) {
			const { data } = await supabase
				.from("motion24_pjProker")
				.select("*")
				.eq("nim", nim);
			if (data.length > 0) {
				const { error } = await supabase
					.from("motion24_pjProker")
					.delete()
					.eq("nim", nim);
				if (error) {
					return { status: "err", msg: error };
				}
			}

			const { error } = await supabase
				.from("motion24_pjProker")
				.upsert(
					id_proker.map((id) => ({
						nim,
						id_proker: id,
					}))
				)
				.eq("nim", nim);
			if (error) {
				return { status: "err", msg: error };
			}
		}
		return { status: "ok", msg: "success update user" };
	},
};

module.exports = user;